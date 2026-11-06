export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: unknown[] = [],
    /** Extra response headers, e.g. Retry-After or WWW-Authenticate. */
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (code: string, message: string): AppError =>
  new AppError(404, code, message);
