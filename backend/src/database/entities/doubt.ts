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

  @Column({ name: 'teacher_requested_at', type: 'timestamptz', nullable: true })
  teacherRequestedAt!: Date | null;

  @Column({ name: 'teacher_answer', type: 'text', nullable: true })
  teacherAnswer!: string | null;

  @Column({ name: 'answered_at', type: 'timestamptz', nullable: true })
  answeredAt!: Date | null;

  @Column({ name: 'answered_by', type: 'uuid', nullable: true })
  answeredBy!: string | null;

  @Column({ name: 'ai_helpful', type: 'boolean', nullable: true })
  aiHelpful!: boolean | null;

  @Column({ name: 'teacher_helpful', type: 'boolean', nullable: true })
  teacherHelpful!: boolean | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  misconception!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
