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
  AI_TIMEOUT_MS: Type.Integer({ minimum: 100, maximum: 60000, default: 8000 }),
  LLM_API_KEY: Type.Optional(Type.String({ minLength: 1 })),
  LLM_MODEL: Type.Optional(Type.String({ minLength: 1 })),
});

export type Env = Static<typeof EnvSchema>;

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
    LLM_PROVIDER: source.LLM_PROVIDER || undefined,
    LLM_API_KEY: source.LLM_API_KEY || undefined,
    LLM_MODEL: source.LLM_MODEL || undefined,
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
  return withDefaults;
}
