import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaEntity } from './entities/media.entity';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(MediaEntity)
    private readonly mediaRepository: Repository<MediaEntity>,
  ) {}

  async upload(
    achievementApiName: string,
    appId: number,
    type: 'image' | 'video',
    file: Express.Multer.File,
    caption?: string,
  ): Promise<MediaEntity> {
    const id = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase() || this.getExtFromMime(file.mimetype);
    const filename = `${id}${ext}`;
    const destPath = path.join(this.uploadsDir, filename);

    try {
      // Move file from multer temp location (or buffer) to uploads directory
      if (file.path) {
        fs.renameSync(file.path, destPath);
      } else if (file.buffer) {
        fs.writeFileSync(destPath, file.buffer);
      } else {
        throw new InternalServerErrorException('No file data available');
      }
    } catch (err) {
      this.logger.error(`Failed to save file ${filename}`, err?.message);
      throw new InternalServerErrorException('Failed to save uploaded file');
    }

    const entity = this.mediaRepository.create({
      id,
      achievementApiName,
      appId,
      type,
      url: `/uploads/${filename}`,
      thumbnailUrl: null,
      caption: caption ?? null,
      filename,
    });

    return this.mediaRepository.save(entity);
  }

  async findByAchievement(achievementApiName: string, appId: number): Promise<MediaEntity[]> {
    return this.mediaRepository.find({
      where: { achievementApiName, appId },
      order: { uploadedAt: 'DESC' },
    });
  }

  async findByGame(appId: number): Promise<MediaEntity[]> {
    return this.mediaRepository.find({
      where: { appId },
      order: { uploadedAt: 'DESC' },
    });
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const entity = await this.mediaRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Media item with id ${id} not found`);
    }

    const filePath = path.join(this.uploadsDir, entity.filename);

    // Delete file from disk (ignore error if already missing)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.logger.warn(`Could not delete file ${filePath}: ${err?.message}`);
    }

    await this.mediaRepository.remove(entity);
    return { deleted: true };
  }

  private getExtFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
    };
    return map[mime] || '';
  }
}
