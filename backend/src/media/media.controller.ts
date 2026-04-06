import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { MediaEntity } from './entities/media.entity';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * POST /api/media/upload/:achievementApiName
   * Multipart form-data: file, appId, type, caption (optional)
   */
  @Post('upload/:achievementApiName')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const path = require('path');
          const fs = require('fs');
          const uploadsDir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          // Use a temp name; the service will rename it with the final UUID
          const { v4: uuidv4 } = require('uuid');
          const path = require('path');
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `tmp-${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              `File type "${file.mimetype}" is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadMedia(
    @Param('achievementApiName') achievementApiName: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('appId') appIdStr: string,
    @Body('type') type: string,
    @Body('caption') caption?: string,
  ): Promise<MediaEntity> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const appId = parseInt(appIdStr, 10);
    if (isNaN(appId)) {
      throw new BadRequestException('appId must be a valid number');
    }

    if (type !== 'image' && type !== 'video') {
      throw new BadRequestException('type must be "image" or "video"');
    }

    return this.mediaService.upload(achievementApiName, appId, type as 'image' | 'video', file, caption);
  }

  /**
   * GET /api/media/game/:appId
   * Returns all media for a given game
   * NOTE: This route must be declared before /:achievementApiName to avoid route conflicts
   */
  @Get('game/:appId')
  async getMediaByGame(
    @Param('appId', ParseIntPipe) appId: number,
  ): Promise<MediaEntity[]> {
    return this.mediaService.findByGame(appId);
  }

  /**
   * GET /api/media/:achievementApiName?appId=123
   * Returns all media for a specific achievement
   */
  @Get(':achievementApiName')
  async getMediaByAchievement(
    @Param('achievementApiName') achievementApiName: string,
    @Query('appId') appIdStr: string,
  ): Promise<MediaEntity[]> {
    const appId = parseInt(appIdStr, 10);
    if (isNaN(appId)) {
      throw new BadRequestException('appId query parameter must be a valid number');
    }
    return this.mediaService.findByAchievement(achievementApiName, appId);
  }

  /**
   * DELETE /api/media/:mediaId
   * Deletes a media item from disk and the database
   */
  @Delete(':mediaId')
  async deleteMedia(
    @Param('mediaId') mediaId: string,
  ): Promise<{ deleted: boolean }> {
    return this.mediaService.delete(mediaId);
  }
}
