import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Doubt } from './doubt.js';

@Entity({ name: 'doubt_hints' })
export class DoubtHint {
  @PrimaryColumn({ name: 'doubt_id', type: 'uuid' })
  doubtId!: string;

  @PrimaryColumn({ type: 'int' })
  level!: number;

  @ManyToOne(() => Doubt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doubt_id' })
  doubt!: Doubt;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'varchar', length: 10 })
  source!: 'llm' | 'reference';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
