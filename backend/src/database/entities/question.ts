import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Topic } from './topic.js';

export type Difficulty = 'easy' | 'medium' | 'hard';
export interface QuestionOption {
  key: string;
  text: string;
}

@Entity({ name: 'questions' })
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_questions_topic_id')
  @Column({ name: 'topic_id', type: 'uuid' })
  topicId!: string;

  @ManyToOne(() => Topic, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'topic_id' })
  topic!: Topic;

  @Column({ type: 'text' })
  statement!: string;

  @Column({ type: 'jsonb' })
  options!: QuestionOption[];

  @Column({ name: 'correct_option', type: 'varchar', length: 8 })
  correctOption!: string;

  @Column({ type: 'varchar', length: 10 })
  difficulty!: Difficulty;

  @Column({ name: 'reference_explanation', type: 'text' })
  referenceExplanation!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
