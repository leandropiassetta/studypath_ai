import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Attempt } from './attempt.js';
import { Question } from './question.js';
import { Student } from './student.js';

export type DoubtStatus = 'AI_HINTS' | 'WAITING_TEACHER' | 'ANSWERED';

@Entity({ name: 'doubts' })
@Unique('uq_doubts_attempt_question', ['attemptId', 'questionId'])
export class Doubt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_doubts_student_id')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId!: string;

  @ManyToOne(() => Attempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt!: Attempt;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;

  @Column({ type: 'varchar', length: 300, nullable: true })
  message!: string | null;

  @Column({ name: 'hints_used', type: 'int', default: 0 })
  hintsUsed!: number;

  @Column({ type: 'varchar', length: 20, default: 'AI_HINTS' })
  status!: DoubtStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
