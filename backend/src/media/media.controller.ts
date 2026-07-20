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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

interface CreateUploadTicketBody {
  appId: number | string;
  type: 'image' | 'video';
  fileName: string;
  contentType: string;
  sizeBytes: number | string;
}

interface GameMediaBody {
  achievementApiNames?: string[];
}

interface SanUploadBody {
  ownerSteamId?: string;
  steam3Id?: string;
  appId: number | string;
}

interface SanUploadTicketBody extends SanUploadBody, CreateUploadTicketBody {}

interface SanCompleteUploadBody {
  ownerSteamId?: string;
  steam3Id?: string;
}

type UploadedMediaFiles = Record<string, Array<{
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}>>;

@Controller('media/san')
export class SanMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url/:achievementApiName')
  async createUploadTicket(
    @Param('achievementApiName') achievementApiName: string,
    @Body() body: SanUploadTicketBody,
  ): Promise<MediaUploadTicket> {
    const ownerSteamId = this.resolveOwnerSteamId(body);
    const { appId, type, sizeBytes } = this.validateUploadTicket(achievementApiName, body);

    return this.mediaService.createUploadTicket({
      ownerSteamId,
      achievementApiName,
      appId,
      type,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes,
    });
  }

  @Post('complete/:mediaId')
  async completeUpload(
    @Param('mediaId') mediaId: string,
    @Body() body: SanCompleteUploadBody,
  ): Promise<MediaEntity> {
    const ownerSteamId = this.resolveOwnerSteamId(body);
    return this.mediaService.completeUpload(ownerSteamId, mediaId);
  }

  @Post('achievement/:achievementApiName')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ], {
    limits: {
      files: 2,
      fileSize: MAX_VIDEO_SIZE,
    },
  }))
  async uploadAchievementMedia(
    @Param('achievementApiName') achievementApiName: string,
    @Body() body: SanUploadBody,
    @UploadedFiles() files: UploadedMediaFiles,
  ): Promise<{ media: MediaEntity[] }> {
    const appId = Number(body.appId);
    const ownerSteamId = this.resolveOwnerSteamId(body);

    if (!Number.isInteger(appId) || appId <= 0) {
      throw new BadRequestException('appId must be a valid positive number');
    }
    if (!achievementApiName?.trim()) {
      throw new BadRequestException('achievementApiName is required');
    }

    const uploads = [
      ...(files?.image ?? []).map((file) => ({ type: 'image' as const, file })),
      ...(files?.video ?? []).map((file) => ({ type: 'video' as const, file })),
    ];

    if (uploads.length === 0) {
      throw new BadRequestException('At least one image or video file is required');
    }

    const media = await Promise.all(
      uploads.map(({ type, file }) => {
        this.validateFile(type, file);
        return this.mediaService.uploadDirect({
          ownerSteamId,
          achievementApiName,
          appId,
          type,
          fileName: file.originalname,
          contentType: file.mimetype,
          sizeBytes: file.size,
          buffer: file.buffer,
        });
      }),
    );

    return { media };
  }

  private resolveOwnerSteamId(body: SanCompleteUploadBody): string {
    if (body.ownerSteamId && /^\d{17}$/.test(body.ownerSteamId)) {
      return body.ownerSteamId;
    }

    if (body.steam3Id && /^\d+$/.test(body.steam3Id)) {
      return this.addDecimalStrings('76561197960265728', body.steam3Id);
    }

    throw new BadRequestException('ownerSteamId or steam3Id is required');
  }

  private validateUploadTicket(
    achievementApiName: string,
    body: CreateUploadTicketBody,
  ): { appId: number; type: 'image' | 'video'; sizeBytes: number } {
    const appId = Number(body.appId);
    const sizeBytes = Number(body.sizeBytes);
    const type = body.type;

    if (!Number.isInteger(appId) || appId <= 0) {
      throw new BadRequestException('appId must be a valid positive number');
    }
    if (!achievementApiName?.trim()) {
      throw new BadRequestException('achievementApiName is required');
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

    return { appId, type, sizeBytes };
  }

  private validateFile(type: 'image' | 'video', file: UploadedMediaFiles[string][number]): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException(`${type} file is empty`);
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed`);
    }
    if (type === 'image' && !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Image upload does not match the file content type');
    }
    if (type === 'video' && !file.mimetype.startsWith('video/')) {
      throw new BadRequestException('Video upload does not match the file content type');
    }

    const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Maximum size is ${Math.floor(maxSize / 1024 / 1024)}MB.`);
    }
  }

  private addDecimalStrings(left: string, right: string): string {
    let carry = 0;
    let result = '';
    let i = left.length - 1;
    let j = right.length - 1;

    while (i >= 0 || j >= 0 || carry > 0) {
      const sum = (i >= 0 ? Number(left[i--]) : 0) + (j >= 0 ? Number(right[j--]) : 0) + carry;
      result = String(sum % 10) + result;
      carry = Math.floor(sum / 10);
    }

    return result;
  }
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

  @Post('game/:appId/resolve')
  async resolveMediaByGame(
    @Req() req: Request,
    @Param('appId', ParseIntPipe) appId: number,
    @Body() body: GameMediaBody,
  ): Promise<MediaEntity[]> {
    const achievementApiNames = Array.isArray(body.achievementApiNames)
      ? body.achievementApiNames.filter((value) => typeof value === 'string' && value.trim())
      : [];
    return this.mediaService.findByGame(this.user(req).steamId, appId, achievementApiNames);
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
