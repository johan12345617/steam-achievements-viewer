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

  @Column({ type: 'varchar', default: '' })
  ownerSteamId: string;

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

  @Column({ type: 'varchar', nullable: true })
  objectKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  recordKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  contentType: string | null;

  @Column({ type: 'integer', default: 0 })
  sizeBytes: number;

  @Column({ type: 'varchar', default: 'ready' })
  status: 'pending' | 'ready';

  @CreateDateColumn()
  uploadedAt: Date;
}
