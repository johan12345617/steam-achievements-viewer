import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { MediaService, MediaUploadTicket } from './media.service';
import { MediaEntity } from './entities/media.entity';
import { SteamSessionGuard } from '../auth/steam-session.guard';
import { SteamSessionUser } from '../auth/steam-session';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

interface CreateUploadTicketBody {
  appId: number | string;
  type: 'image' | 'video';
  caption?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | string;
}

@UseGuards(SteamSessionGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url/:achievementApiName')
  async createUploadTicket(
    @Req() req: Request,
    @Param('achievementApiName') achievementApiName: string,
    @Body() body: CreateUploadTicketBody,
  ): Promise<MediaUploadTicket> {
    const appId = Number(body.appId);
    const sizeBytes = Number(body.sizeBytes);
    const type = body.type;

    if (!Number.isInteger(appId) || appId <= 0) {
      throw new BadRequestException('appId must be a valid positive number');
    }
    if (type !== 'image' && type !== 'video') {
      throw new BadRequestException('type must be "image" or "video"');
    }
    if (!body.fileName?.trim()) {
      throw new BadRequestException('fileName is required');
    }
    if (!ALLOWED_MIME_TYPES.includes(body.contentType)) {
      throw new BadRequestException(`File type "${body.contentType}" is not allowed`);
    }
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be a valid positive number');
    }

    const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (sizeBytes > maxSize) {
      throw new BadRequestException(`File too large. Maximum size is ${Math.floor(maxSize / 1024 / 1024)}MB.`);
    }
    if (type === 'image' && !body.contentType.startsWith('image/')) {
      throw new BadRequestException('Selected media type does not match the file content type');
    }
    if (type === 'video' && !body.contentType.startsWith('video/')) {
      throw new BadRequestException('Selected media type does not match the file content type');
    }

    return this.mediaService.createUploadTicket({
      ownerSteamId: this.user(req).steamId,
      achievementApiName,
      appId,
      type,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes,
      caption: body.caption?.slice(0, 200),
    });
  }

  @Post('complete/:mediaId')
  async completeUpload(
    @Req() req: Request,
    @Param('mediaId') mediaId: string,
  ): Promise<MediaEntity> {
    return this.mediaService.completeUpload(this.user(req).steamId, mediaId);
  }

  @Get('game/:appId')
  async getMediaByGame(
    @Req() req: Request,
    @Param('appId', ParseIntPipe) appId: number,
  ): Promise<MediaEntity[]> {
    return this.mediaService.findByGame(this.user(req).steamId, appId);
  }

  @Get(':achievementApiName')
  async getMediaByAchievement(
    @Req() req: Request,
    @Param('achievementApiName') achievementApiName: string,
    @Query('appId') appIdStr: string,
  ): Promise<MediaEntity[]> {
    const appId = parseInt(appIdStr, 10);
    if (isNaN(appId)) {
      throw new BadRequestException('appId query parameter must be a valid number');
    }
    return this.mediaService.findByAchievement(this.user(req).steamId, achievementApiName, appId);
  }

  @Delete(':mediaId')
  async deleteMedia(
    @Req() req: Request,
    @Param('mediaId') mediaId: string,
  ): Promise<{ deleted: boolean }> {
    return this.mediaService.delete(this.user(req).steamId, mediaId);
  }

  private user(req: Request): SteamSessionUser {
    return req.user as SteamSessionUser;
  }
}
