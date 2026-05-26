import { Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  clearSteamSessionCookie,
  createSteamSessionCookie,
  readSteamSession,
  setSteamSessionCookie,
  SteamSessionUser,
} from './steam-session';

@Controller('auth')
export class AuthController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * GET /api/auth/steam
   * Redirects the user to Steam OpenID login page
   */
  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  steamLogin() {
    // Passport handles the redirect to Steam — this method body is never reached
  }

  /**
   * GET /api/auth/steam/callback
   * Steam redirects back here after the user authenticates.
   * Extracts the steamId and redirects to the Angular frontend.
   */
  @Get('steam/callback')
  @UseGuards(AuthGuard('steam'))
  steamCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as SteamSessionUser | undefined;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    if (!user?.steamId) {
      return res.redirect(`${frontendUrl}/?error=auth_failed`);
    }

    const token = createSteamSessionCookie(user, this.sessionSecret);
    setSteamSessionCookie(res, token, this.isProduction);
    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Get('me')
  getSession(@Req() req: Request): SteamSessionUser {
    const user = readSteamSession(req, this.sessionSecret);
    if (!user) {
      throw new UnauthorizedException('No active Steam session.');
    }
    return user;
  }

  @Post('logout')
  logout(@Res() res: Response) {
    clearSteamSessionCookie(res, this.isProduction);
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
