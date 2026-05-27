import { Body, Controller, Get, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { RetroAchievementsService } from './retroachievements.service';
import { RetroGameDetail, RetroGamesResponse } from './dto/retroachievements-response.dto';
import {
  clearRetroAchievementsSessionCookie,
  createRetroAchievementsSessionCookie,
  readRetroAchievementsSession,
  setRetroAchievementsSessionCookie,
} from './retroachievements-session';

interface ConnectRetroAchievementsBody {
  username?: string;
}

@UseGuards(ThrottlerGuard)
@Controller('retroachievements')
export class RetroAchievementsController {
  constructor(
    private readonly retroAchievementsService: RetroAchievementsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('games/:username')
  async getGamesWithUnlocks(@Param('username') username: string): Promise<RetroGamesResponse> {
    return this.retroAchievementsService.getGamesWithUnlocks(username);
  }

  @Get('game/:gameId/:username')
  async getGameProgress(
    @Param('gameId') gameId: string,
    @Param('username') username: string,
  ): Promise<RetroGameDetail> {
    return this.retroAchievementsService.getGameProgress(username, Number(gameId));
  }

  @Get('me')
  getSession(@Req() req: Request): { username: string } {
    const user = readRetroAchievementsSession(req, this.sessionSecret);
    if (!user) {
      throw new UnauthorizedException('No active RetroAchievements connection.');
    }
    return user;
  }

  @Get('connected-games')
  async getConnectedGames(@Req() req: Request): Promise<RetroGamesResponse> {
    const user = readRetroAchievementsSession(req, this.sessionSecret);
    if (!user) {
      throw new UnauthorizedException('No active RetroAchievements connection.');
    }
    return this.retroAchievementsService.getGamesWithUnlocks(user.username);
  }

  @Get('connected-game/:gameId')
  async getConnectedGameProgress(
    @Req() req: Request,
    @Param('gameId') gameId: string,
  ): Promise<RetroGameDetail> {
    const user = readRetroAchievementsSession(req, this.sessionSecret);
    if (!user) {
      throw new UnauthorizedException('No active RetroAchievements connection.');
    }
    return this.retroAchievementsService.getGameProgress(user.username, Number(gameId));
  }

  @Post('connect')
  async connect(
    @Body() body: ConnectRetroAchievementsBody,
    @Res() res: Response,
  ): Promise<Response<RetroGamesResponse>> {
    const username = body.username?.trim() ?? '';
    const data = await this.retroAchievementsService.getGamesWithUnlocks(username);
    const token = createRetroAchievementsSessionCookie({ username: data.username }, this.sessionSecret);
    setRetroAchievementsSessionCookie(res, token, this.isProduction);
    return res.json(data);
  }

  @Post('disconnect')
  disconnect(@Res() res: Response) {
    clearRetroAchievementsSessionCookie(res, this.isProduction);
    return res.json({ ok: true });
  }

  private get sessionSecret(): string {
    const secret = this.configService.get<string>('AUTH_COOKIE_SECRET');
    if (!secret && this.isProduction) {
      throw new Error('AUTH_COOKIE_SECRET must be set in production.');
    }
    return secret || 'local-dev-change-me';
  }

  private get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
