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
import { Student } from './student.js';

/** Server-side session. Only the SHA-256 of the bearer token is stored. */
@Entity({ name: 'sessions' })
@Unique('uq_sessions_token_hash', ['tokenHash'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_sessions_student_id')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index('idx_sessions_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
