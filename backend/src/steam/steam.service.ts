import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  PlayerSummary,
  GetPlayerSummariesResponse,
  OwnedGame,
  GetOwnedGamesResponse,
  PlayerAchievement,
  GetPlayerAchievementsResponse,
  GetSchemaForGameResponse,
  GetGlobalAchievementPercentagesResponse,
  GetGameAchievementsResponse,
  GameAchievementEntry,
  SchemaAchievement,
  MergedAchievement,
  ResolveVanityURLResponse,
} from './dto/steam-response.dto';

@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);
  private readonly baseUrl = 'https://api.steampowered.com';
  private readonly cdnBase = 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('STEAM_API_KEY');
    if (!key) {
      throw new HttpException('STEAM_API_KEY is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return key;
  }

  async getPlayerSummary(steamId: string): Promise<PlayerSummary> {
    const url = `${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<GetPlayerSummariesResponse>(url, {
          params: {
            key: this.apiKey,
            steamids: steamId,
          },
        }),
      );

      const players = response.data?.response?.players;
      if (!players || players.length === 0) {
        throw new HttpException(`Player with steamId ${steamId} not found`, HttpStatus.NOT_FOUND);
      }

      return players[0];
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Failed to fetch player summary for ${steamId}`, err?.message);
      throw new HttpException('Failed to fetch player data from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async getOwnedGames(steamId: string): Promise<OwnedGame[]> {
    const url = `${this.baseUrl}/IPlayerService/GetOwnedGames/v0001/`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<GetOwnedGamesResponse>(url, {
          params: {
            key: this.apiKey,
            steamid: steamId,
            include_appinfo: 1,
            include_played_free_games: 1,
          },
        }),
      );

      const games = response.data?.response?.games;
      if (!games) {
        // Profile may be private or user has no games
        return [];
      }

      return games;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Failed to fetch owned games for ${steamId}`, err?.message);
      throw new HttpException('Failed to fetch games from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async getGamesWithStats(steamId: string): Promise<(OwnedGame & { achievementsTotal: number; achievementsUnlocked: number; achievementPercentage: number })[]> {
    const games = await this.getOwnedGames(steamId);
    const eligibleGames = games.filter((g) => g.has_community_visible_stats);
    const statsMap = new Map<number, { total: number; unlocked: number }>();

    const playerUrl = `${this.baseUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`;
    const concurrency = 20;

    for (let i = 0; i < eligibleGames.length; i += concurrency) {
      const batch = eligibleGames.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(async (game) => {
          try {
            const res = await firstValueFrom(
              this.httpService.get<GetPlayerAchievementsResponse>(playerUrl, {
                params: { key: this.apiKey, appid: game.appid, steamid: steamId },
              }),
            );
            const stats = res.data?.playerstats;
            if (stats?.success && stats?.achievements) {
              const total = stats.achievements.length;
              const unlocked = stats.achievements.filter((a) => a.achieved === 1).length;
              statsMap.set(game.appid, { total, unlocked });
            }
          } catch {
            // Game has no stats, private profile, or error — skip
          }
        }),
      );
    }

    return games.map((game) => {
      const stats = statsMap.get(game.appid);
      return {
        ...game,
        achievementsTotal: stats?.total ?? 0,
        achievementsUnlocked: stats?.unlocked ?? 0,
        achievementPercentage:
          stats && stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0,
      };
    });
  }

  async getAchievements(appId: string, steamId: string): Promise<{ achievements: MergedAchievement[]; gameName: string; error?: string }> {
    const playerUrl = `${this.baseUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`;
    const schemaUrl = `${this.baseUrl}/ISteamUserStats/GetSchemaForGame/v0002/`;
    const globalUrl = `${this.baseUrl}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/`;
    const richUrl  = `${this.baseUrl}/IPlayerService/GetGameAchievements/v1/`;

    try {
      const [playerRes, schemaRes, globalRes, richRes] = await Promise.all([
        firstValueFrom(
          this.httpService.get<GetPlayerAchievementsResponse>(playerUrl, {
            params: { key: this.apiKey, appid: appId, steamid: steamId, l: 'english' },
          }),
        ).catch((err) => {
          this.logger.warn(`Player achievements fetch failed for app ${appId}: ${err?.message}`);
          return null;
        }),
        firstValueFrom(
          this.httpService.get<GetSchemaForGameResponse>(schemaUrl, {
            params: { key: this.apiKey, appid: appId, l: 'english' },
          }),
        ).catch((err) => {
          this.logger.warn(`Schema fetch failed for app ${appId}: ${err?.message}`);
          return null;
        }),
        firstValueFrom(
          this.httpService.get<GetGlobalAchievementPercentagesResponse>(globalUrl, {
            params: { gameid: appId },
          }),
        ).catch((err) => {
          this.logger.warn(`Global percentages fetch failed for app ${appId}: ${err?.message}`);
          return null;
        }),
        firstValueFrom(
          this.httpService.get<GetGameAchievementsResponse>(richUrl, {
            params: { key: this.apiKey, appid: appId, language: 'english' },
          }),
        ).catch((err) => {
          this.logger.warn(`GetGameAchievements fetch failed for app ${appId}: ${err?.message}`);
          return null;
        }),
      ]);

      // Check for private profile or game with no stats
      const playerStats = playerRes?.data?.playerstats;
      if (playerStats && !playerStats.success) {
        const errorMsg = playerStats.error || 'Profile is private or game has no achievements';
        return { achievements: [], gameName: '', error: errorMsg };
      }

      const schemaAchievements = schemaRes?.data?.game?.availableGameStats?.achievements ?? [];
      const playerAchievements = playerStats?.achievements ?? [];
      const globalPercentages = globalRes?.data?.achievementpercentages?.achievements ?? [];
      const richAchievements = richRes?.data?.response?.achievements ?? [];
      const gameName = playerStats?.gameName || schemaRes?.data?.game?.gameName || '';

      if (schemaAchievements.length === 0 && richAchievements.length === 0) {
        return { achievements: [], gameName, error: 'This game has no achievements' };
      }

      // Rich endpoint descriptions keyed by internal_name — preferred over schema
      const richMap = new Map<string, GameAchievementEntry>(
        richAchievements.map((a: GameAchievementEntry) => [a.internal_name, a]),
      );

      // Build lookup maps for O(1) access
      const playerMap = new Map<string, PlayerAchievement>(playerAchievements.map((a) => [a.apiname, a]));
      const globalMap = new Map<string, number>(globalPercentages.map((g) => [g.name, g.percent]));

      // Use schema as the base list; fall back to richAchievements if schema is empty
      const baseList: Array<{ name: string; schema: SchemaAchievement | null }> =
        schemaAchievements.length > 0
          ? schemaAchievements.map((schema: SchemaAchievement) => ({ name: schema.name, schema }))
          : richAchievements.map((r: GameAchievementEntry) => ({ name: r.internal_name, schema: null }));

      const merged: MergedAchievement[] = baseList.map(({ name, schema }) => {
        const player = playerMap.get(name);
        const rich = richMap.get(name);
        const globalPercent = globalMap.get(name) ?? null;

        // Prefer rich endpoint for display name and description (more complete)
        const displayName = rich?.localized_name || schema?.displayName || name;
        const description = rich?.localized_desc || schema?.description || '';

        // rich endpoint returns full URLs; schema returns only hashes — handle both
        const toIconUrl = (value: string | undefined): string => {
          if (!value) return '';
          if (value.startsWith('http')) return value; // already a full URL
          const hash = value.endsWith('.jpg') ? value.slice(0, -4) : value;
          return `${this.cdnBase}/${appId}/${hash}.jpg`; // hash → construct URL
        };

        return {
          apiName: name,
          displayName,
          description,
          icon: toIconUrl(rich?.icon || schema?.icon),
          iconGray: toIconUrl(rich?.icon_gray || schema?.icongray),
          achieved: player ? player.achieved === 1 : false,
          unlockTime: player?.unlocktime ?? 0,
          globalPercent,
          hidden: rich?.hidden ?? schema?.hidden === 1,
        };
      });

      return { achievements: merged, gameName };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Failed to fetch achievements for app ${appId}, steam ${steamId}`, (err as Error)?.message);
      throw new HttpException('Failed to fetch achievements from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async getHeaderImage(appId: string): Promise<{ url: string; libraryUrl: string }> {
    const url = `https://store.steampowered.com/api/appdetails`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<Record<string, { success: boolean; data?: { header_image?: string } }>>(url, {
          params: { appids: appId, filters: 'basic' },
        }),
      );
      const headerImage = response.data?.[appId]?.data?.header_image;
      if (!headerImage) {
        throw new HttpException(`No header image found for app ${appId}`, HttpStatus.NOT_FOUND);
      }
      return { url: headerImage, libraryUrl: headerImage };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Failed to fetch header image for app ${appId}`, (err as Error)?.message);
      throw new HttpException('Failed to fetch game image from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async resolveVanityUrl(vanityUrl: string): Promise<string> {
    const url = `${this.baseUrl}/ISteamUser/ResolveVanityURL/v0001/`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<ResolveVanityURLResponse>(url, {
          params: {
            key: this.apiKey,
            vanityurl: vanityUrl,
          },
        }),
      );

      const result = response.data?.response;
      if (!result || result.success !== 1 || !result.steamid) {
        throw new HttpException(
          result?.message || `Could not resolve vanity URL: ${vanityUrl}`,
          HttpStatus.NOT_FOUND,
        );
      }

      return result.steamid;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Failed to resolve vanity URL ${vanityUrl}`, err?.message);
      throw new HttpException('Failed to resolve vanity URL from Steam', HttpStatus.BAD_GATEWAY);
    }
  }
}
