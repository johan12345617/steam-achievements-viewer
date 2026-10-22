import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SteamService } from '../steam/steam.service';
import { SteamSessionUser } from './steam-session';

@Injectable()
export class SteamIdentityService {
  constructor(private readonly steam: SteamService) {}

  async resolveVerifiedIdentifier(identifier: string): Promise<SteamSessionUser> {
    const steamId = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(identifier)?.[1];
    if (!steamId) throw new UnauthorizedException('Steam returned an invalid identifier.');
    // passport-steam 1.0.18 uses regex match[0] (the entire URL) for its optional
    // profile request. Fetch the profile with the verified numeric ID ourselves.
    const profile = await this.steam.getPlayerSummary(steamId);
    if (profile.steamid !== steamId) throw new UnauthorizedException('Steam returned a different profile.');
    return {
      steamId,
      displayName: typeof profile.personaname === 'string' ? profile.personaname : '',
      avatar: typeof profile.avatarfull === 'string' ? profile.avatarfull : '',
    };
  }
}
