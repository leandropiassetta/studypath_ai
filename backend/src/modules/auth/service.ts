import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError, notFound } from '../../shared/errors/app-error.js';
import { FailureLimiter } from './limiter.js';
import { DEFAULT_SCRYPT_COST, hashPassword, verifyPassword } from './password.js';
import { EmailTakenError, type AuthRepository } from './repository.js';
import type { AuthResult, LoginInput, RegisterInput } from './schemas.js';

export interface AuthContext {
  studentId: string;
  sessionId: string;
  role: 'student' | 'teacher';
}

export interface AuthOptions {
  sessionTtlMs: number;
  /** Secret that lets someone sign up as a teacher. Without it, teacher sign-up is off. */
  teacherInviteCode?: string;
  passwordCost?: number;
  now?: () => number;
}

const DAY_MS = 24 * 60 * 60_000;
export const DEFAULT_SESSION_TTL_MS = 7 * DAY_MS;

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos';

/** The token is shown once; only this hash is stored, so a database leak cannot be replayed. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export class AuthService {
  private readonly now: () => number;
  private readonly passwordCost: number;
  // 5 wrong passwords per account+IP, 20 per IP, per 15 min; 20 sign-ups per IP per hour.
  private readonly loginByAccount: FailureLimiter;
  private readonly loginByIp: FailureLimiter;
  private readonly signups: FailureLimiter;
  // Wrong invite codes: 5 per IP per 15 min, so the code cannot be guessed.
  private readonly inviteFailures: FailureLimiter;
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly repo: AuthRepository,
    private readonly options: AuthOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.passwordCost = options.passwordCost ?? DEFAULT_SCRYPT_COST;
    this.loginByAccount = new FailureLimiter(5, 15 * 60_000, this.now);
    this.loginByIp = new FailureLimiter(20, 15 * 60_000, this.now);
    this.signups = new FailureLimiter(20, 60 * 60_000, this.now);
    this.inviteFailures = new FailureLimiter(5, 15 * 60_000, this.now);
  }

  async register(input: RegisterInput, ip: string): Promise<AuthResult> {
    this.assertNotBlocked(this.signups, `signup|${ip}`);
    this.signups.recordFailure(`signup|${ip}`); // every attempt counts, successful or not

    const email = normalizeEmail(input.email);
    const name = input.name.trim();
    if (name.length === 0) throw new AppError(400, 'INVALID_REQUEST', 'Nome inválido');
    // The role is only ever granted here, after the invite code is checked: never trust the client.
    const role = input.role === 'teacher' ? 'teacher' : 'student';
    if (role === 'teacher') this.checkInviteCode(input.inviteCode, ip);
    if (await this.repo.findByEmail(email)) throw emailTaken();

    const passwordHash = await hashPassword(input.password, this.passwordCost);
    try {
      const student = await this.repo.createStudent({ name, email, passwordHash, role });
      return this.openSession(student.id, { id: student.id, name, email, role });
    } catch (err) {
      if (err instanceof EmailTakenError) throw emailTaken();
      throw err;
    }
  }

  async login(input: LoginInput, ip: string): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const accountKey = `${email}|${ip}`;
    const ipKey = `ip|${ip}`;
    this.assertNotBlocked(this.loginByAccount, accountKey);
    this.assertNotBlocked(this.loginByIp, ipKey);

    const student = await this.repo.findByEmail(email);
    // Always do one scrypt verification, so an unknown e-mail costs the same time as a wrong password.
    const hash = student?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await verifyPassword(input.password, hash);

    if (!student || !student.passwordHash || !passwordOk) {
      this.loginByAccount.recordFailure(accountKey);
      this.loginByIp.recordFailure(ipKey);
      throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }

    this.loginByAccount.reset(accountKey);
    await this.repo.deleteExpiredSessions(new Date(this.now()));
    return this.openSession(student.id, {
      id: student.id,
      name: student.name,
      email,
      role: student.role,
    });
  }

  async logout(ctx: AuthContext): Promise<void> {
    await this.repo.deleteSession(ctx.sessionId);
  }

  async me(ctx: AuthContext): Promise<AuthResult['student']> {
    const student = await this.repo.findById(ctx.studentId);
    if (!student) throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado');
    return { id: student.id, name: student.name, email: student.email, role: student.role };
  }

  /** Resolves a bearer token to its session, or null if unknown or expired. */
  async authenticate(token: string): Promise<AuthContext | null> {
    const session = await this.repo.findValidSession(hashToken(token), new Date(this.now()));
    return session
      ? { studentId: session.studentId, sessionId: session.sessionId, role: session.role }
      : null;
  }

  private async openSession(
    studentId: string,
    student: AuthResult['student'],
  ): Promise<AuthResult> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now() + this.options.sessionTtlMs);
    await this.repo.createSession(studentId, hashToken(token), expiresAt);
    return { token, expiresAt: expiresAt.toISOString(), student };
  }

  /** Constant-time comparison of the invite code; wrong guesses are rate limited per IP. */
  private checkInviteCode(given: string | undefined, ip: string): void {
    const expected = this.options.teacherInviteCode;
    if (!expected) {
      throw new AppError(403, 'TEACHER_SIGNUP_DISABLED', 'O cadastro de professor está desativado');
    }
    const key = `invite|${ip}`;
    this.assertNotBlocked(this.inviteFailures, key);
    const digest = (v: string): Buffer => createHash('sha256').update(v).digest();
    const ok = given !== undefined && timingSafeEqual(digest(given), digest(expected));
    if (!ok) {
      this.inviteFailures.recordFailure(key);
      throw new AppError(403, 'INVALID_INVITE_CODE', 'Código de convite inválido');
    }
    this.inviteFailures.reset(key);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword('not-a-real-password', this.passwordCost);
    return this.dummyHash;
  }

  private assertNotBlocked(limiter: FailureLimiter, key: string): void {
    const retryAfter = limiter.retryAfterSeconds(key);
    if (retryAfter !== null) {
      throw new AppError(
        429,
        'TOO_MANY_ATTEMPTS',
        'Muitas tentativas. Aguarde um pouco e tente de novo.',
        [],
        { 'retry-after': String(retryAfter) },
      );
    }
  }
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const emailTaken = (): AppError =>
  new AppError(409, 'EMAIL_TAKEN', 'Já existe uma conta com este e-mail');
