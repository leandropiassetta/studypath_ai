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
});

export type Env = Static<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = {
    APP_ENV: source.APP_ENV,
    HOST: source.HOST,
    PORT: source.PORT === undefined || source.PORT === '' ? undefined : Number(source.PORT),
    DATABASE_URL: source.DATABASE_URL,
    DEMO_STUDENT_ID: source.DEMO_STUDENT_ID,
  };
  const withDefaults = Value.Default(EnvSchema, Value.Clean(EnvSchema, raw)) as unknown;
  if (!Value.Check(EnvSchema, withDefaults)) {
    const details = [...Value.Errors(EnvSchema, withDefaults)]
      .map((e) => `${e.path || '/'}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  return withDefaults;
}
