import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { readSteamSession } from './steam-session';

@Injectable()
export class SteamSessionGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = readSteamSession(request, this.sessionSecret);
    if (!user) {
      throw new UnauthorizedException('Sign in with Steam to manage achievement media.');
    }
    request.user = user;
    return true;
  }

  private get sessionSecret(): string {
    const secret = this.configService.get<string>('AUTH_COOKIE_SECRET');
    if (!secret && this.configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('AUTH_COOKIE_SECRET must be set in production.');
    }
    return secret || 'local-dev-change-me';
  }
}
