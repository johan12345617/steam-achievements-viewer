import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
// passport-steam exports a Strategy constructor — import it carefully
const SteamStrategy = require('passport-steam').Strategy;

@Injectable()
export class SteamAuthStrategy extends PassportStrategy(SteamStrategy, 'steam') {
  constructor(private readonly configService: ConfigService) {
    super({
      returnURL: `${configService.get('BACKEND_URL') || 'http://localhost:3000'}/api/auth/steam/callback`,
      realm: configService.get('BACKEND_URL') || 'http://localhost:3000',
      apiKey: configService.get('STEAM_API_KEY') || '',
    });
  }

  async validate(identifier: string, profile: any, done: (err: any, user: any) => void): Promise<any> {
    // identifier is the full OpenID claimed_id URL, e.g.:
    // https://steamcommunity.com/openid/id/76561198XXXXXXXXX
    const steamId = identifier.replace('https://steamcommunity.com/openid/id/', '');
    const user = {
      steamId,
      displayName: profile?.displayName || '',
      avatar: profile?.photos?.[2]?.value || '',
    };
    done(null, user);
  }
}
