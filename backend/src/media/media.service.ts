import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MediaEntity } from './entities/media.entity';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface CreateMediaUploadInput {
  ownerSteamId: string;
  achievementApiName: string;
  appId: number;
  type: 'image' | 'video';
  fileName: string;
  contentType: string;
  sizeBytes: number;
  caption?: string;
}

export interface MediaUploadTicket {
  media: MediaEntity;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

const SIGNED_READ_EXPIRES_SECONDS = 15 * 60;
const SIGNED_UPLOAD_EXPIRES_SECONDS = 5 * 60;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');
  private s3Client: S3Client | null = null;

  constructor(
    @InjectRepository(MediaEntity)
    private readonly mediaRepository: Repository<MediaEntity>,
    private readonly configService: ConfigService,
  ) {}

  async createUploadTicket(input: CreateMediaUploadInput): Promise<MediaUploadTicket> {
    this.assertR2Configured();

    const id = uuidv4();
    const ext = this.getExtFromFile(input.fileName, input.contentType);
    const safeAchievement = this.safeKeySegment(input.achievementApiName);
    const objectKey = `users/${input.ownerSteamId}/games/${input.appId}/achievements/${safeAchievement}/media/${id}${ext}`;
    const recordKey = `users/${input.ownerSteamId}/games/${input.appId}/achievements/${safeAchievement}/records/${id}.json`;

    const entity = this.mediaRepository.create({
      id,
      ownerSteamId: input.ownerSteamId,
      achievementApiName: input.achievementApiName,
      appId: input.appId,
      type: input.type,
      url: objectKey,
      thumbnailUrl: null,
      caption: input.caption ?? null,
      filename: `${id}${ext}`,
      objectKey,
      recordKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: 'pending',
    });
    await this.mediaRepository.save(entity);

    const metadata = this.buildObjectMetadata(entity);
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        ContentType: input.contentType,
        Metadata: metadata,
      }),
      { expiresIn: SIGNED_UPLOAD_EXPIRES_SECONDS },
    );

    return {
      media: entity,
      uploadUrl,
      headers: {
        'Content-Type': input.contentType,
      },
      expiresInSeconds: SIGNED_UPLOAD_EXPIRES_SECONDS,
    };
  }

  async completeUpload(ownerSteamId: string, id: string): Promise<MediaEntity> {
    const entity = await this.findOwnedMedia(ownerSteamId, id);
    if (entity.status === 'ready') {
      return this.withSignedUrls(entity);
    }

    const record = {
      id: entity.id,
      ownerSteamId: entity.ownerSteamId,
      appId: entity.appId,
      achievementApiName: entity.achievementApiName,
      type: entity.type,
      caption: entity.caption,
      filename: entity.filename,
      objectKey: entity.objectKey,
      contentType: entity.contentType,
      sizeBytes: entity.sizeBytes,
      uploadedAt: entity.uploadedAt,
    };

    await this.assertUploadedObjectExists(entity.objectKey);
    await this.putRecord(entity.recordKey, record);
    entity.status = 'ready';
    await this.mediaRepository.save(entity);
    return this.withSignedUrls(entity);
  }

  async findByAchievement(ownerSteamId: string, achievementApiName: string, appId: number): Promise<MediaEntity[]> {
    const media = await this.mediaRepository.find({
      where: { ownerSteamId, achievementApiName, appId, status: 'ready' },
      order: { uploadedAt: 'DESC' },
    });
    return Promise.all(media.map((item) => this.withSignedUrls(item)));
  }

  async findByGame(ownerSteamId: string, appId: number): Promise<MediaEntity[]> {
    const media = await this.mediaRepository.find({
      where: { ownerSteamId, appId, status: 'ready' },
      order: { uploadedAt: 'DESC' },
    });
    return Promise.all(media.map((item) => this.withSignedUrls(item)));
  }

  async delete(ownerSteamId: string, id: string): Promise<{ deleted: boolean }> {
    const entity = await this.findOwnedMedia(ownerSteamId, id);

    if (entity.objectKey) {
      await this.deleteR2Object(entity.objectKey);
    } else {
      await this.deleteLocalFile(entity.filename);
    }

    if (entity.recordKey) {
      await this.deleteR2Object(entity.recordKey);
    }

    await this.mediaRepository.remove(entity);
    return { deleted: true };
  }

  private async findOwnedMedia(ownerSteamId: string, id: string): Promise<MediaEntity> {
    const entity = await this.mediaRepository.findOne({ where: { id, ownerSteamId } });
    if (!entity) {
      throw new NotFoundException(`Media item with id ${id} not found`);
    }
    return entity;
  }

  private async withSignedUrls(entity: MediaEntity): Promise<MediaEntity> {
    const clone = { ...entity };
    if (entity.objectKey) {
      clone.url = await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: entity.objectKey,
        }),
        { expiresIn: SIGNED_READ_EXPIRES_SECONDS },
      );
      clone.thumbnailUrl = entity.type === 'image' ? clone.url : null;
    }
    return clone as MediaEntity;
  }

  private async putRecord(recordKey: string | null, record: unknown): Promise<void> {
    if (!recordKey) {
      return;
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: recordKey,
        ContentType: 'application/json',
        Body: JSON.stringify(record, null, 2),
      }),
    );
  }

  private async assertUploadedObjectExists(objectKey: string | null): Promise<void> {
    if (!objectKey) {
      throw new InternalServerErrorException('Media object key is missing');
    }

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        }),
      );
    } catch {
      throw new BadRequestException('Upload has not reached R2 yet. Please retry in a moment.');
    }
  }

  private async deleteR2Object(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (err) {
      this.logger.warn(`Could not delete R2 object ${key}: ${err?.message}`);
    }
  }

  private async deleteLocalFile(filename: string): Promise<void> {
    const filePath = path.join(this.uploadsDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.logger.warn(`Could not delete file ${filePath}: ${err?.message}`);
    }
  }

  private buildObjectMetadata(entity: MediaEntity): Record<string, string> {
    return {
      steamid: entity.ownerSteamId,
      appid: String(entity.appId),
      achievement: this.safeMetadataValue(entity.achievementApiName),
      mediaid: entity.id,
      type: entity.type,
    };
  }

  private getExtFromFile(fileName: string, mime: string): string {
    const ext = path.extname(fileName).toLowerCase();
    if (ext && /^[a-z0-9.]+$/.test(ext)) {
      return ext;
    }

    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
    };
    return map[mime] || '';
  }

  private safeKeySegment(value: string): string {
    const safe = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
    if (!safe) {
      throw new BadRequestException('achievementApiName must contain at least one safe character');
    }
    return safe;
  }

  private safeMetadataValue(value: string): string {
    return value.replace(/[^\x20-\x7E]/g, '').slice(0, 256);
  }

  private assertR2Configured(): void {
    const missing = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
    ].filter((key) => !this.configService.get<string>(key));

    if (missing.length > 0) {
      throw new InternalServerErrorException(`R2 is not configured. Missing: ${missing.join(', ')}`);
    }
  }

  private get client(): S3Client {
    this.assertR2Configured();
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.configService.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        credentials: {
          accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get<string>('R2_SECRET_ACCESS_KEY'),
        },
      });
    }
    return this.s3Client;
  }

  private get bucketName(): string {
    return this.configService.get<string>('R2_BUCKET');
  }
}
