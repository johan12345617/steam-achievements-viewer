import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('achievement_media')
export class MediaEntity {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  achievementApiName: string;

  @Column({ type: 'integer' })
  appId: number;

  @Column({ type: 'varchar' })
  type: 'image' | 'video';

  @Column({ type: 'varchar' })
  url: string;

  @Column({ type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  caption: string | null;

  @Column({ type: 'varchar' })
  filename: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
