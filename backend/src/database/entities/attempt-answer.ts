import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Attempt } from './attempt.js';
import { Question } from './question.js';

@Entity({ name: 'attempt_answers' })
@Unique('uq_attempt_answers_attempt_question', ['attemptId', 'questionId'])
export class AttemptAnswer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId!: string;

  @ManyToOne(() => Attempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt!: Attempt;

  @Index('idx_attempt_answers_question_id')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;

  @Column({ name: 'selected_option', type: 'varchar', length: 8 })
  selectedOption!: string;

  @Column({ name: 'is_correct', type: 'boolean' })
  isCorrect!: boolean;
}
