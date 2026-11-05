export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (code: string, message: string): AppError =>
  new AppError(404, code, message);
