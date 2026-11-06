import { AppError } from './app-error.js';

/** RN-10: demo mode accepts a single fictitious student; anyone else gets 403. */
export function assertDemoStudent(studentId: string, demoStudentId: string): void {
  if (studentId !== demoStudentId) {
    throw new AppError(403, 'FORBIDDEN', 'Estudante não autorizado');
  }
}
