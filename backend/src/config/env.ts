import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const EnvSchema = Type.Object({
  APP_ENV: Type.Union([Type.Literal('demo')], { default: 'demo' }),
  HOST: Type.String({ default: '127.0.0.1' }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  DATABASE_URL: Type.String({ pattern: '^postgres(ql)?://' }),
  DEMO_STUDENT_ID: Type.String({
    pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    default: '55555555-5555-4555-8555-555555555555',
  }),
  AI_MODE: Type.Union([Type.Literal('disabled'), Type.Literal('mock'), Type.Literal('real')], {
    default: 'disabled',
  }),
  LLM_PROVIDER: Type.Union([Type.Literal('anthropic'), Type.Literal('openai')], {
    default: 'anthropic',
  }),
  SESSION_TTL_DAYS: Type.Integer({ minimum: 1, maximum: 90, default: 7 }),
  AI_MAX_CALLS_PER_MINUTE: Type.Integer({ minimum: 1, maximum: 1000, default: 6 }),
  AI_MAX_CALLS_PER_DAY: Type.Integer({ minimum: 1, maximum: 100000, default: 50 }),
  AI_TIMEOUT_MS: Type.Integer({ minimum: 100, maximum: 60000, default: 8000 }),
  /** Cap on AI calls for everyone together per 24 h (protects a shared provider quota). */
  AI_MAX_CALLS_GLOBAL_PER_DAY: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000_000 })),
  /** Extra browser origins allowed by CORS (the deployed app), e.g. https://user.github.io */
  ALLOWED_ORIGINS: Type.Array(Type.String({ pattern: '^https?://[A-Za-z0-9.-]+(:\\d{1,5})?$' }), {
    default: [],
  }),
  /** How many reverse proxies sit in front of the API (0 = none). Needed for per-IP limits. */
  TRUST_PROXY: Type.Integer({ minimum: 0, maximum: 5, default: 0 }),
  LLM_API_KEY: Type.Optional(Type.String({ minLength: 1 })),
  LLM_MODEL: Type.Optional(Type.String({ minLength: 1 })),
  /** OpenAI-compatible endpoint (e.g. https://api.groq.com/openai). Default: api.openai.com. */
  LLM_BASE_URL: Type.Optional(Type.String({ pattern: '^https?://' })),
  /** Secret for teacher sign-up (min 8 chars). Without it nobody can sign up as a teacher. */
  TEACHER_INVITE_CODE: Type.Optional(Type.String({ minLength: 8, maxLength: 128 })),
  /** Without it the background jobs are off and everything still works synchronously. */
  REDIS_URL: Type.Optional(Type.String({ pattern: '^rediss?://' })),
  /** How long before a doubt still waiting for a teacher is flagged (default: the 14 min ETA). */
  SLA_DELAY_MS: Type.Integer({ minimum: 1000, maximum: 86_400_000, default: 14 * 60_000 }),
});

export type Env = Static<typeof EnvSchema>;

const numberOrUndefined = (v: string | undefined): number | undefined =>
  v === undefined || v === '' ? undefined : Number(v);

/** "https://a.dev, https://b.dev/" -> ["https://a.dev", "https://b.dev"]. Empty or unset -> undefined. */
const parseOrigins = (value: string | undefined): string[] | undefined => {
  const list = (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);
  return list.length > 0 ? list : undefined;
};

const isLoopbackHost = (host: string): boolean =>
  host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = {
    APP_ENV: source.APP_ENV,
    HOST: source.HOST,
    PORT: source.PORT === undefined || source.PORT === '' ? undefined : Number(source.PORT),
    DATABASE_URL: source.DATABASE_URL,
    DEMO_STUDENT_ID: source.DEMO_STUDENT_ID,
    AI_MODE: source.AI_MODE,
    AI_TIMEOUT_MS:
      source.AI_TIMEOUT_MS === undefined || source.AI_TIMEOUT_MS === ''
        ? undefined
        : Number(source.AI_TIMEOUT_MS),
    SESSION_TTL_DAYS: numberOrUndefined(source.SESSION_TTL_DAYS),
    AI_MAX_CALLS_PER_MINUTE: numberOrUndefined(source.AI_MAX_CALLS_PER_MINUTE),
    AI_MAX_CALLS_GLOBAL_PER_DAY: numberOrUndefined(source.AI_MAX_CALLS_GLOBAL_PER_DAY),
    ALLOWED_ORIGINS: parseOrigins(source.ALLOWED_ORIGINS),
    TRUST_PROXY: numberOrUndefined(source.TRUST_PROXY),
    AI_MAX_CALLS_PER_DAY: numberOrUndefined(source.AI_MAX_CALLS_PER_DAY),
    LLM_PROVIDER: source.LLM_PROVIDER || undefined,
    LLM_API_KEY: source.LLM_API_KEY || undefined,
    LLM_MODEL: source.LLM_MODEL || undefined,
    LLM_BASE_URL: source.LLM_BASE_URL || undefined,
    REDIS_URL: source.REDIS_URL || undefined,
    TEACHER_INVITE_CODE: source.TEACHER_INVITE_CODE || undefined,
    SLA_DELAY_MS: numberOrUndefined(source.SLA_DELAY_MS),
  };
  const withDefaults = Value.Default(EnvSchema, Value.Clean(EnvSchema, raw)) as unknown;
  if (!Value.Check(EnvSchema, withDefaults)) {
    const details = [...Value.Errors(EnvSchema, withDefaults)]
      .map((e) => `${e.path || '/'}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  if (withDefaults.AI_MODE === 'real' && (!withDefaults.LLM_API_KEY || !withDefaults.LLM_MODEL)) {
    throw new Error('Invalid environment: AI_MODE=real requires LLM_API_KEY and LLM_MODEL');
  }
  if (!isLoopbackHost(withDefaults.HOST) && source.ALLOW_NON_LOOPBACK_HOST !== 'true') {
    throw new Error(
      'Invalid environment: HOST is not a loopback address. The API speaks plain HTTP (no TLS); ' +
        'set ALLOW_NON_LOOPBACK_HOST=true only behind a TLS-terminating proxy you control.',
    );
  }
  return withDefaults;
}
