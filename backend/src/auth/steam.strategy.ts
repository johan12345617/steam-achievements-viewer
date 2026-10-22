import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { SteamIdentityService } from './steam-identity.service';
// passport-steam exports a Strategy constructor — import it carefully
const SteamStrategy = require('passport-steam').Strategy;

@Injectable()
export class SteamAuthStrategy extends PassportStrategy(SteamStrategy, 'steam') {
  constructor(private readonly configService: ConfigService, private readonly identity: SteamIdentityService) {
    super({
      returnURL: `${configService.get('BACKEND_URL') || 'http://localhost:3000'}/api/auth/steam/callback`,
      realm: configService.get('BACKEND_URL') || 'http://localhost:3000',
      profile: false,
    });
  }

  async validate(identifier: string, profile: any, done: (err: any, user: any) => void): Promise<any> {
    try {
      done(null, await this.identity.resolveVerifiedIdentifier(identifier));
    } catch (error) {
      done(error, false);
    }
  }
}
