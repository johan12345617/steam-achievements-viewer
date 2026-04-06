import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

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
    const user = req.user as { steamId: string; displayName: string; avatar: string } | undefined;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    if (!user?.steamId) {
      return res.redirect(`${frontendUrl}/?error=auth_failed`);
    }

    return res.redirect(`${frontendUrl}/dashboard?steamId=${user.steamId}`);
  }
}
