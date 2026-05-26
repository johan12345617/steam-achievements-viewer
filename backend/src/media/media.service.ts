import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MediaEntity } from './entities/media.entity';
import * as path from 'path';

export interface CreateMediaUploadInput {
  ownerSteamId: string;
  achievementApiName: string;
  appId: number;
  type: 'image' | 'video';
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface MediaUploadTicket {
  media: MediaEntity;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

const SIGNED_READ_EXPIRES_SECONDS = 15 * 60;
const SIGNED_UPLOAD_EXPIRES_SECONDS = 5 * 60;
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private s3Client: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  async createUploadTicket(input: CreateMediaUploadInput): Promise<MediaUploadTicket> {
    this.assertR2Configured();

    const ext = this.getExtFromFile(input.fileName, input.contentType);
    const safeAchievement = this.safeKeySegment(input.achievementApiName);
    const filename = `${input.type}${ext}`;
    const objectKey = this.mediaObjectKey(input.ownerSteamId, input.appId, safeAchievement, filename);
    const media = this.createMediaEntity({
      ownerSteamId: input.ownerSteamId,
      achievementApiName: input.achievementApiName,
      appId: input.appId,
      type: input.type,
      filename,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedAt: new Date(),
    });

    const metadata = this.buildObjectMetadata(media);
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
      media,
      uploadUrl,
      headers: {
        'Content-Type': input.contentType,
      },
      expiresInSeconds: SIGNED_UPLOAD_EXPIRES_SECONDS,
    };
  }

  async completeUpload(ownerSteamId: string, mediaId: string): Promise<MediaEntity> {
    const parts = this.parseMediaId(mediaId);
    if (!parts || parts.ownerSteamId !== ownerSteamId) {
      throw new NotFoundException(`Media item with id ${mediaId} not found`);
    }

    await this.assertUploadedObjectExists(parts.objectKey);
    const media = this.createMediaEntity({
      ownerSteamId,
      achievementApiName: parts.achievementApiName,
      appId: parts.appId,
      type: parts.type,
      filename: parts.filename,
      objectKey: parts.objectKey,
      contentType: this.contentTypeFromFilename(parts.filename),
      uploadedAt: new Date(),
    });
    return this.withSignedUrls(media);
  }

  async findByAchievement(ownerSteamId: string, achievementApiName: string, appId: number): Promise<MediaEntity[]> {
    const media = await this.findMediaForAchievement(ownerSteamId, appId, achievementApiName);
    return Promise.all(media.map((item) => this.withSignedUrls(item)));
  }

  async findByGame(
    ownerSteamId: string,
    appId: number,
    achievementApiNames: string[] = [],
  ): Promise<MediaEntity[]> {
    if (achievementApiNames.length > 0) {
      const nested = await Promise.all(
        achievementApiNames.map((achievementApiName) =>
          this.findMediaForAchievement(ownerSteamId, appId, achievementApiName),
        ),
      );
      return Promise.all(nested.flat().map((item) => this.withSignedUrls(item)));
    }

    const prefix = `users/${ownerSteamId}/games/${appId}/achievements/`;
    const objects = await this.listObjects(prefix);
    const byAchievement = new Map<string, _Object[]>();

    for (const object of objects) {
      if (!object.Key || !object.Key.includes('/media/')) {
        continue;
      }
      const match = object.Key.match(/^users\/[^/]+\/games\/\d+\/achievements\/([^/]+)\/media\/[^/]+$/);
      if (!match) {
        continue;
      }
      const achievementApiName = match[1];
      const list = byAchievement.get(achievementApiName) ?? [];
      list.push(object);
      byAchievement.set(achievementApiName, list);
    }

    const media = [...byAchievement.entries()].flatMap(([achievementApiName, achievementObjects]) =>
      this.pickAchievementMedia(ownerSteamId, appId, achievementApiName, achievementObjects),
    );
    return Promise.all(media.map((item) => this.withSignedUrls(item)));
  }

  async delete(ownerSteamId: string, mediaId: string): Promise<{ deleted: boolean }> {
    const parts = this.parseMediaId(mediaId);
    if (!parts || parts.ownerSteamId !== ownerSteamId) {
      throw new NotFoundException(`Media item with id ${mediaId} not found`);
    }

    await this.deleteR2Object(parts.objectKey);
    return { deleted: true };
  }

  private async findMediaForAchievement(
    ownerSteamId: string,
    appId: number,
    achievementApiName: string,
  ): Promise<MediaEntity[]> {
    const safeAchievement = this.safeKeySegment(achievementApiName);
    const prefix = this.mediaPrefix(ownerSteamId, appId, safeAchievement);
    const objects = await this.listObjects(prefix);
    return this.pickAchievementMedia(ownerSteamId, appId, achievementApiName, objects);
  }

  private pickAchievementMedia(
    ownerSteamId: string,
    appId: number,
    achievementApiName: string,
    objects: _Object[],
  ): MediaEntity[] {
    const latestImage = this.latestObjectByType(objects, 'image');
    const latestVideo = this.latestObjectByType(objects, 'video');
    return [latestImage, latestVideo]
      .filter((object): object is _Object & { Key: string } => Boolean(object?.Key))
      .map((object) => {
        const filename = path.posix.basename(object.Key);
        const type = this.mediaTypeFromFilename(filename);
        return this.createMediaEntity({
          ownerSteamId,
          achievementApiName,
          appId,
          type,
          filename,
          objectKey: object.Key,
          contentType: this.contentTypeFromFilename(filename),
          sizeBytes: object.Size ?? 0,
          uploadedAt: object.LastModified ?? new Date(),
        });
      });
  }

  private latestObjectByType(objects: _Object[], type: 'image' | 'video'): _Object | null {
    const extensions = type === 'image' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
    return objects
      .filter((object) => object.Key && extensions.includes(path.posix.extname(object.Key).toLowerCase()))
      .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))[0] ?? null;
  }

  private async listObjects(prefix: string): Promise<_Object[]> {
    const objects: _Object[] = [];
    let token: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      objects.push(...(response.Contents ?? []));
      token = response.NextContinuationToken;
    } while (token);

    return objects;
  }

  private createMediaEntity(input: {
    ownerSteamId: string;
    achievementApiName: string;
    appId: number;
    type: 'image' | 'video';
    filename: string;
    objectKey: string;
    contentType?: string | null;
    sizeBytes?: number;
    uploadedAt: Date;
  }): MediaEntity {
    return {
      id: this.mediaId(input.objectKey),
      ownerSteamId: input.ownerSteamId,
      achievementApiName: input.achievementApiName,
      appId: input.appId,
      type: input.type,
      url: input.objectKey,
      thumbnailUrl: input.type === 'image' ? input.objectKey : null,
      caption: null,
      filename: input.filename,
      objectKey: input.objectKey,
      recordKey: null,
      contentType: input.contentType ?? null,
      sizeBytes: input.sizeBytes ?? 0,
      status: 'ready',
      uploadedAt: input.uploadedAt,
    };
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
    return clone;
  }

  private async assertUploadedObjectExists(objectKey: string): Promise<void> {
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

  private mediaPrefix(ownerSteamId: string, appId: number, achievementApiName: string): string {
    return `users/${ownerSteamId}/games/${appId}/achievements/${achievementApiName}/media/`;
  }

  private mediaObjectKey(ownerSteamId: string, appId: number, achievementApiName: string, filename: string): string {
    return `${this.mediaPrefix(ownerSteamId, appId, achievementApiName)}${filename}`;
  }

  private mediaId(objectKey: string): string {
    return Buffer.from(objectKey).toString('base64url');
  }

  private parseMediaId(mediaId: string): {
    ownerSteamId: string;
    appId: number;
    achievementApiName: string;
    type: 'image' | 'video';
    filename: string;
    objectKey: string;
  } | null {
    try {
      const objectKey = Buffer.from(mediaId, 'base64url').toString('utf8');
      const match = objectKey.match(/^users\/([^/]+)\/games\/(\d+)\/achievements\/([^/]+)\/media\/([^/]+)$/);
      if (!match) {
        return null;
      }
      const filename = match[4];
      return {
        ownerSteamId: match[1],
        appId: Number(match[2]),
        achievementApiName: match[3],
        type: this.mediaTypeFromFilename(filename),
        filename,
        objectKey,
      };
    } catch {
      return null;
    }
  }

  private buildObjectMetadata(entity: MediaEntity): Record<string, string> {
    return {
      steamid: entity.ownerSteamId,
      appid: String(entity.appId),
      achievement: this.safeMetadataValue(entity.achievementApiName),
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

  private mediaTypeFromFilename(filename: string): 'image' | 'video' {
    const ext = path.posix.extname(filename).toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext)) {
      return 'image';
    }
    if (VIDEO_EXTENSIONS.includes(ext)) {
      return 'video';
    }
    throw new BadRequestException(`Unsupported media file extension: ${ext}`);
  }

  private contentTypeFromFilename(filename: string): string | null {
    const ext = path.posix.extname(filename).toLowerCase();
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    };
    return map[ext] ?? null;
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
