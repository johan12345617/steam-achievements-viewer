import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SteamService } from './steam.service';
import { PlayerSummary, OwnedGame, MergedAchievement } from './dto/steam-response.dto';

@UseGuards(ThrottlerGuard)
@Controller('steam')
export class SteamController {
  constructor(private readonly steamService: SteamService) {}

  /**
   * GET /api/steam/player/:steamId
   * Returns player profile summary from Steam
   */
  @Get('player/:steamId')
  async getPlayer(@Param('steamId') steamId: string): Promise<PlayerSummary> {
    return this.steamService.getPlayerSummary(steamId);
  }

  /**
   * GET /api/steam/games/:steamId
   * Returns list of owned games for the given Steam ID
   */
  @Get('games/:steamId')
  async getGames(@Param('steamId') steamId: string): Promise<OwnedGame[]> {
    return this.steamService.getOwnedGames(steamId);
  }

  /**
   * GET /api/steam/games-with-stats/:steamId
   * Returns owned games with achievement counts (total, unlocked, percentage)
   */
  @Get('games-with-stats/:steamId')
  async getGamesWithStats(@Param('steamId') steamId: string) {
    return this.steamService.getGamesWithStats(steamId);
  }

  /**
   * GET /api/steam/achievements/:appId/:steamId
   * Returns merged achievement data: player progress + schema + global percentages
   */
  @Get('achievements/:appId/:steamId')
  async getAchievements(
    @Param('appId') appId: string,
    @Param('steamId') steamId: string,
  ): Promise<{ achievements: MergedAchievement[]; gameName: string; error?: string }> {
    return this.steamService.getAchievements(appId, steamId);
  }

  /**
   * GET /api/steam/resolve/:vanityUrl
   * Resolves a Steam vanity URL to a 64-bit Steam ID
   */
  @Get('resolve/:vanityUrl')
  async resolveVanity(@Param('vanityUrl') vanityUrl: string): Promise<{ steamId: string }> {
    const steamId = await this.steamService.resolveVanityUrl(vanityUrl);
    return { steamId };
  }

  /**
   * GET /api/steam/header/:appId
   * Returns the header image URL for a game from the Steam Store API
   */
  @Get('header/:appId')
  async getHeaderImage(@Param('appId') appId: string): Promise<{ url: string; libraryUrl: string }> {
    return this.steamService.getHeaderImage(appId);
  }
}
