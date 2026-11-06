import { Type, type Static } from '@sinclair/typebox';

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;

export const RegisterBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 80 }),
    email: Type.String({ format: 'email', maxLength: 254 }),
    password: Type.String({ minLength: MIN_PASSWORD_LENGTH, maxLength: MAX_PASSWORD_LENGTH }),
  },
  { additionalProperties: false },
);
export type RegisterInput = Static<typeof RegisterBody>;

export const LoginBody = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 254 }),
    // No minimum here: a login must fail with the same generic error, never reveal the policy.
    password: Type.String({ minLength: 1, maxLength: MAX_PASSWORD_LENGTH }),
  },
  { additionalProperties: false },
);
export type LoginInput = Static<typeof LoginBody>;

export const StudentResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  role: Type.Union([Type.Literal('student'), Type.Literal('teacher')]),
});

export const AuthResponse = Type.Object({
  token: Type.String(),
  expiresAt: Type.String(),
  student: StudentResponse,
});
export type AuthResult = Static<typeof AuthResponse>;
