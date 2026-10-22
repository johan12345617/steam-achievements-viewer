import { Body, Controller, Get, Header, HttpCode, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  clearSteamSessionCookie,
  createSteamSessionCookie,
  setSteamSessionCookie,
  SteamSessionUser,
} from './steam-session';
import { MobileAuthService, MOBILE_REDIRECT_URI } from './mobile-auth.service';
import { SteamCallbackGuard } from './steam-callback.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly configService: ConfigService, private readonly mobileAuth: MobileAuthService) {}

  @Get('mobile/config')
  @Header('Cache-Control', 'no-store')
  mobileConfig() {
    return { enabled: true, version: 1, redirectUri: MOBILE_REDIRECT_URI, codeChallengeMethod: 'S256' };
  }

  @Post('mobile/start')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  mobileStart(@Body() body: unknown) {
    return this.mobileAuth.start(body);
  }

  @Get('mobile/steam')
  mobileSteam(@Query('transaction') transaction: unknown, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.redirect(this.mobileAuth.launch(transaction, res));
  }

  @Post('mobile/exchange')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  mobileExchange(@Body() body: unknown) {
    return this.mobileAuth.exchange(body);
  }

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
  @UseGuards(SteamCallbackGuard)
  steamCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as SteamSessionUser | undefined;

    if (typeof req.query.mobile === 'string') {
      return res.redirect(this.mobileAuth.complete(req.query.mobile, user, res));
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    if (!user?.steamId) {
      return res.redirect(`${frontendUrl}/?error=auth_failed`);
    }

    const token = createSteamSessionCookie(user, this.sessionSecret);
    setSteamSessionCookie(res, token, this.isProduction);
    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  getSession(@Req() req: Request): SteamSessionUser {
    const user = this.mobileAuth.readSession(req, this.sessionSecret);
    if (!user) {
      throw new UnauthorizedException('No active Steam session.');
    }
    return user;
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  logout(@Req() req: Request, @Res() res: Response) {
    this.mobileAuth.logout(req);
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
