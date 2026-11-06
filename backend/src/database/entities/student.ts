import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'students' })
@Unique('uq_students_email', ['email'])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Lower-cased. Null only for accounts without credentials (the seeded demo student). */
  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  /** scrypt hash string; never returned by the API. */
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'student' })
  role!: 'student' | 'teacher';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
