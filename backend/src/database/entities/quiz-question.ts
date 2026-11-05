import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { Question } from './question.js';
import { Quiz } from './quiz.js';

@Entity({ name: 'quiz_questions' })
@Unique('uq_quiz_questions_position', ['quizId', 'position'])
export class QuizQuestion {
  @PrimaryColumn({ name: 'quiz_id', type: 'uuid' })
  quizId!: string;

  @Index('idx_quiz_questions_question_id')
  @PrimaryColumn({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @Column({ type: 'int' })
  position!: number;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz!: Quiz;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;
}
