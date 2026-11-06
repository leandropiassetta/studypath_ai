import { AppError } from './app-error.js';

/** The student named in the path or body must be the authenticated one. */
export function assertSameStudent(
  requestedStudentId: string,
  authenticatedStudentId: string,
): void {
  if (requestedStudentId !== authenticatedStudentId) {
    throw new AppError(403, 'FORBIDDEN', 'Você só pode acessar os dados da sua própria conta');
  }
}
