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
import { Quiz } from './quiz.js';
import { Student } from './student.js';

@Entity({ name: 'attempts' })
@Unique('uq_attempts_student_request', ['studentId', 'requestId'])
@Index('idx_attempts_student_submitted', ['studentId', 'submittedAt'])
export class Attempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => Student, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  @Index('idx_attempts_quiz_id')
  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId!: string;

  @ManyToOne(() => Quiz, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quiz_id' })
  quiz!: Quiz;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId!: string;

  @Column({ name: 'payload_hash', type: 'char', length: 64 })
  payloadHash!: string;

  @Column({ name: 'correct_count', type: 'int' })
  correctCount!: number;

  @Column({ name: 'total_count', type: 'int' })
  totalCount!: number;

  // numeric comes back from pg as string; convert so callers always see a number.
  @Column({
    name: 'score_pct',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? v : Number(v)) },
  })
  scorePct!: number;

  /** The graded result as first returned; replays serve this, never a re-grade. */
  @Column({ name: 'result', type: 'jsonb', nullable: true })
  result!: object | null;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;
}
