import type { DataSource } from 'typeorm';

export interface StudentRecord {
  id: string;
  name: string;
  email: string | null;
  passwordHash: string | null;
  role: Role;
}

export type Role = 'student' | 'teacher';

export interface SessionRecord {
  sessionId: string;
  studentId: string;
  role: Role;
}

/** Thrown when the e-mail is already registered (also under concurrent sign-ups). */
export class EmailTakenError extends Error {
  constructor() {
    super('email already registered');
    this.name = 'EmailTakenError';
  }
}

interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  password_hash: string | null;
  role: Role;
}

const toRecord = (r: StudentRow): StudentRecord => ({
  id: r.id,
  name: r.name,
  email: r.email,
  passwordHash: r.password_hash,
  role: r.role,
});

export class AuthRepository {
  constructor(private readonly ds: DataSource) {}

  async findByEmail(email: string): Promise<StudentRecord | null> {
    const rows = await this.ds.query<StudentRow[]>(
      'SELECT id, name, email, password_hash, role FROM students WHERE email = $1',
      [email],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findById(id: string): Promise<StudentRecord | null> {
    const rows = await this.ds.query<StudentRow[]>(
      'SELECT id, name, email, password_hash, role FROM students WHERE id = $1',
      [id],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async createStudent(input: {
    name: string;
    email: string;
    passwordHash: string;
    role?: 'student' | 'teacher';
  }): Promise<StudentRecord> {
    try {
      const rows = await this.ds.query<StudentRow[]>(
        `INSERT INTO students (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, password_hash, role`,
        [input.name, input.email, input.passwordHash, input.role ?? 'student'],
      );
      return toRecord(rows[0] as StudentRow);
    } catch (err) {
      const driver = (err as { driverError?: { code?: string; constraint?: string } }).driverError;
      if (driver?.code === '23505' && driver.constraint === 'uq_students_email') {
        throw new EmailTakenError();
      }
      throw err;
    }
  }

  async createSession(studentId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.ds.query(
      'INSERT INTO sessions (student_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [studentId, tokenHash, expiresAt],
    );
  }

  /** A session is valid only while it has not expired. */
  async findValidSession(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const rows = await this.ds.query<{ id: string; student_id: string; role: Role }[]>(
      `SELECT s.id, s.student_id, st.role
       FROM sessions s JOIN students st ON st.id = s.student_id
       WHERE s.token_hash = $1 AND s.expires_at > $2`,
      [tokenHash, now],
    );
    return rows[0]
      ? { sessionId: rows[0].id, studentId: rows[0].student_id, role: rows[0].role }
      : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ds.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    await this.ds.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
  }
}
