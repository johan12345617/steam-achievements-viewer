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
  private readonly isDev = process.env.NODE_ENV !== 'production';

  // In-memory cache: key → { data, expiresAt }
  private readonly cache = new Map<string, { data: unknown; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) return entry.data as T;
    this.cache.delete(key);
    return null;
  }

  private setCached(key: string, data: unknown): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }

  /** Logs only when NODE_ENV !== 'production'. */
  private dev(message: string): void {
    if (this.isDev) this.logger.debug(message);
  }

  /** Logs timing. Always visible (warn level) if over thresholdMs, debug otherwise. */
  private perf(label: string, elapsedMs: number, thresholdMs = 2000): void {
    const msg = `⏱  ${label} — ${elapsedMs}ms`;
    if (elapsedMs >= thresholdMs) {
      this.logger.warn(`🐢 SLOW ${msg}`);
    } else if (this.isDev) {
      this.logger.debug(msg);
    }
  }

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
    const t0 = Date.now();
    this.dev(`→ getPlayerSummary(${steamId})`);
    const url = `${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<GetPlayerSummariesResponse>(url, {
          params: { key: this.apiKey, steamids: steamId },
        }),
      );

      const players = response.data?.response?.players;
      if (!players || players.length === 0) {
        throw new HttpException(`Player with steamId ${steamId} not found`, HttpStatus.NOT_FOUND);
      }

      const player = players[0];
      this.perf(`getPlayerSummary(${steamId})`, Date.now() - t0);
      this.dev(`← getPlayerSummary → name="${player.personaname}" state=${player.personastate}`);
      return player;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getPlayerSummary(${steamId}) failed after ${Date.now() - t0}ms`, err?.message);
      throw new HttpException('Failed to fetch player data from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async getOwnedGames(steamId: string): Promise<OwnedGame[]> {
    const t0 = Date.now();
    this.dev(`→ getOwnedGames(${steamId})`);
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
        this.dev(`← getOwnedGames → no games (private profile or empty library)`);
        return [];
      }

      const withStats = games.filter((g) => g.has_community_visible_stats).length;
      const played = games.filter((g) => (g.rtime_last_played ?? 0) > 0).length;
      this.perf(`getOwnedGames(${steamId})`, Date.now() - t0);
      this.dev(
        `← getOwnedGames → total=${games.length} | with_stats=${withStats} | played=${played}`,
      );
      return games;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getOwnedGames(${steamId}) failed after ${Date.now() - t0}ms`, err?.message);
      throw new HttpException('Failed to fetch games from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async getGamesWithStats(steamId: string): Promise<(OwnedGame & { achievementsTotal: number; achievementsUnlocked: number; achievementPercentage: number })[]> {
    const cacheKey = `gws-${steamId}`;
    const cached = this.getCached<(OwnedGame & { achievementsTotal: number; achievementsUnlocked: number; achievementPercentage: number })[]>(cacheKey);
    if (cached) {
      this.dev(`getGamesWithStats(${steamId}) — cache hit (${cached.length} games)`);
      return cached;
    }

    const t0 = Date.now();
    this.dev(`→ getGamesWithStats(${steamId}) — cache miss, fetching…`);

    const games = await this.getOwnedGames(steamId);
    const eligibleGames = games.filter((g) => g.has_community_visible_stats);
    this.dev(`  getGamesWithStats — ${games.length} total games, ${eligibleGames.length} eligible for stats`);

    const statsMap = new Map<number, { total: number; unlocked: number }>();
    const playerUrl = `${this.baseUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`;
    const concurrency = 50;
    const totalBatches = Math.ceil(eligibleGames.length / concurrency);
    let batchErrors = 0;

    for (let i = 0; i < eligibleGames.length; i += concurrency) {
      const batchNum = Math.floor(i / concurrency) + 1;
      const batch = eligibleGames.slice(i, i + concurrency);
      const batchT0 = Date.now();

      const results = await Promise.allSettled(
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
            batchErrors++;
          }
        }),
      );

      const batchFailed = results.filter((r) => r.status === 'rejected').length;
      this.dev(
        `  batch ${batchNum}/${totalBatches} — ${batch.length} games, ${Date.now() - batchT0}ms` +
        (batchFailed > 0 ? ` (${batchFailed} failed)` : ''),
      );
    }

    const result = games.map((game) => {
      const stats = statsMap.get(game.appid);
      return {
        ...game,
        achievementsTotal: stats?.total ?? 0,
        achievementsUnlocked: stats?.unlocked ?? 0,
        achievementPercentage:
          stats && stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0,
      };
    });

    const withAchievements = result.filter((g) => g.achievementsTotal > 0).length;
    const totalElapsed = Date.now() - t0;
    this.perf(`getGamesWithStats(${steamId})`, totalElapsed, 10000);
    this.dev(
      `← getGamesWithStats — ${games.length} games processed | ${withAchievements} have achievements` +
      ` | ${batchErrors} errors | ${totalElapsed}ms total`,
    );

    this.setCached(cacheKey, result);
    return result;
  }

  /**
   * Fast dashboard endpoint: fetches basic game list (1 API call) then fetches
   * achievements only for the top 10 most recently played games (10 parallel calls).
   * Total time: ~1-3 seconds regardless of library size.
   */
  async getDashboardData(steamId: string): Promise<{
    totalGames: number;
    totalAchievements: number;
    unlockedAchievements: number;
    topGamesWithStats: (OwnedGame & { achievementsTotal: number; achievementsUnlocked: number; achievementPercentage: number })[];
    recentUnlocks: { achievement: MergedAchievement; game: OwnedGame; unlockedAt: number }[];
    rarestAchievement: MergedAchievement | null;
    rarestAchievementGame: OwnedGame | null;
  }> {
    type DashboardResult = Awaited<ReturnType<SteamService['getDashboardData']>>;
    const cacheKey = `dashboard-${steamId}`;
    const cached = this.getCached<DashboardResult>(cacheKey);
    if (cached) {
      this.dev(`getDashboardData(${steamId}) — cache hit`);
      return cached;
    }

    const t0 = Date.now();
    this.dev(`→ getDashboardData(${steamId}) — cache miss, fetching…`);

    // Step 1: basic games list (single API call)
    const t1 = Date.now();
    const allGames = await this.getOwnedGames(steamId);
    this.perf(`  getDashboardData step 1 — getOwnedGames`, Date.now() - t1, 3000);
    this.dev(`  step 1 — ${allGames.length} total games`);

    // Step 2: pick top 10 games with achievement support
    // Primary: sort by last-played timestamp (may be 0 if the profile hides game details)
    // Fallback: if no last-played data is available, sort by total playtime instead
    const withStats = allGames.filter((g) => g.has_community_visible_stats);
    const hasLastPlayed = withStats.some((g) => (g.rtime_last_played ?? 0) > 0);

    this.dev(
      `  step 2 — ${withStats.length} games with stats | hasLastPlayedData=${hasLastPlayed}` +
      (hasLastPlayed ? '' : ' → falling back to playtime sort'),
    );

    const recentEligible = [...withStats]
      .sort((a, b) =>
        hasLastPlayed
          ? (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0)
          : b.playtime_forever - a.playtime_forever,
      )
      .slice(0, 10);

    this.dev(
      `  step 2 — ${recentEligible.length} eligible games selected: ` +
      recentEligible.map((g) => `${g.name ?? g.appid}`).join(', '),
    );

    // Step 3: fetch achievements for those games in parallel
    const t3 = Date.now();
    const achievementResults = await Promise.allSettled(
      recentEligible.map((game) =>
        this.getAchievements(String(game.appid), steamId)
          .then((data) => ({ game, achievements: data.achievements })),
      ),
    );
    this.perf(`  getDashboardData step 3 — ${recentEligible.length} parallel achievement fetches`, Date.now() - t3, 5000);

    const failures = achievementResults.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      this.dev(`  step 3 — ${failures}/${recentEligible.length} achievement fetches failed`);
    }

    // Step 4: process
    const topGamesWithStats: (OwnedGame & { achievementsTotal: number; achievementsUnlocked: number; achievementPercentage: number })[] = [];
    const recentUnlocks: { achievement: MergedAchievement; game: OwnedGame; unlockedAt: number }[] = [];
    let rarestAchievement: MergedAchievement | null = null;
    let rarestAchievementGame: OwnedGame | null = null;
    let rarestPercent = 101;

    for (const result of achievementResults) {
      if (result.status !== 'fulfilled') continue;
      const { game, achievements } = result.value;

      const total = achievements.length;
      const unlocked = achievements.filter((a) => a.achieved).length;
      const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;

      this.dev(`  step 4 — "${game.name ?? game.appid}": ${unlocked}/${total} (${percentage}%)`);

      if (total > 0) {
        topGamesWithStats.push({ ...game, achievementsTotal: total, achievementsUnlocked: unlocked, achievementPercentage: percentage });
      }

      for (const a of achievements) {
        if (a.achieved) {
          recentUnlocks.push({ achievement: a, game, unlockedAt: a.unlockTime ?? 0 });
        }
        if (a.achieved && a.globalPercent != null && a.globalPercent < rarestPercent) {
          rarestPercent = a.globalPercent;
          rarestAchievement = a;
          rarestAchievementGame = game;
        }
      }
    }

    recentUnlocks.sort((a, b) => b.unlockedAt - a.unlockedAt);

    const totalAchievements = topGamesWithStats.reduce((s, g) => s + g.achievementsTotal, 0);
    const unlockedAchievements = topGamesWithStats.reduce((s, g) => s + g.achievementsUnlocked, 0);

    const totalElapsed = Date.now() - t0;
    this.perf(`getDashboardData(${steamId})`, totalElapsed, 5000);
    this.dev(
      `← getDashboardData — ${allGames.length} games total | ${recentUnlocks.length} recent unlocks` +
      ` | rarest="${rarestAchievement?.displayName ?? 'none'}" (${rarestPercent < 101 ? rarestPercent + '%' : 'n/a'})` +
      ` | ${totalElapsed}ms total`,
    );

    const dashboardResult = {
      totalGames: allGames.length,
      totalAchievements,
      unlockedAchievements,
      topGamesWithStats: topGamesWithStats.slice(0, 6),
      recentUnlocks: recentUnlocks.slice(0, 8),
      rarestAchievement,
      rarestAchievementGame,
    };

    this.setCached(cacheKey, dashboardResult);
    return dashboardResult;
  }

  async getAchievements(appId: string, steamId: string): Promise<{ achievements: MergedAchievement[]; gameName: string; error?: string }> {
    const t0 = Date.now();
    this.dev(`→ getAchievements(app=${appId}, steam=${steamId})`);

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
          this.dev(`  getAchievements(${appId}) — player fetch failed: ${err?.message}`);
          return null;
        }),
        firstValueFrom(
          this.httpService.get<GetSchemaForGameResponse>(schemaUrl, {
            params: { key: this.apiKey, appid: appId, l: 'english' },
          }),
        ).catch((err) => {
          this.dev(`  getAchievements(${appId}) — schema fetch failed: ${err?.message}`);
          return null;
        }),
        firstValueFrom(
          this.httpService.get<GetGlobalAchievementPercentagesResponse>(globalUrl, {
            params: { gameid: appId },
          }),
        ).catch((err) => {
          this.dev(`  getAchievements(${appId}) — global% fetch failed: ${err?.message}`);
          return null;
        }),
        firstValueFrom(
          this.httpService.get<GetGameAchievementsResponse>(richUrl, {
            params: { key: this.apiKey, appid: appId, language: 'english' },
          }),
        ).catch((err) => {
          this.dev(`  getAchievements(${appId}) — rich fetch failed: ${err?.message}`);
          return null;
        }),
      ]);

      const playerStats = playerRes?.data?.playerstats;
      if (playerStats && !playerStats.success) {
        const errorMsg = playerStats.error || 'Profile is private or game has no achievements';
        this.dev(`← getAchievements(${appId}) — not available: ${errorMsg}`);
        return { achievements: [], gameName: '', error: errorMsg };
      }

      const schemaAchievements = schemaRes?.data?.game?.availableGameStats?.achievements ?? [];
      const playerAchievements = playerStats?.achievements ?? [];
      const globalPercentages = globalRes?.data?.achievementpercentages?.achievements ?? [];
      const richAchievements = richRes?.data?.response?.achievements ?? [];
      const gameName = playerStats?.gameName || schemaRes?.data?.game?.gameName || '';

      if (schemaAchievements.length === 0 && richAchievements.length === 0) {
        this.dev(`← getAchievements(${appId}) — no achievements found`);
        return { achievements: [], gameName, error: 'This game has no achievements' };
      }

      const richMap = new Map<string, GameAchievementEntry>(
        richAchievements.map((a: GameAchievementEntry) => [a.internal_name, a]),
      );

      const playerMap = new Map<string, PlayerAchievement>(playerAchievements.map((a) => [a.apiname, a]));
      const globalMap = new Map<string, number>(globalPercentages.map((g) => [g.name, g.percent]));

      const baseList: Array<{ name: string; schema: SchemaAchievement | null }> =
        schemaAchievements.length > 0
          ? schemaAchievements.map((schema: SchemaAchievement) => ({ name: schema.name, schema }))
          : richAchievements.map((r: GameAchievementEntry) => ({ name: r.internal_name, schema: null }));

      const merged: MergedAchievement[] = baseList.map(({ name, schema }) => {
        const player = playerMap.get(name);
        const rich = richMap.get(name);
        const globalPercent = globalMap.get(name) ?? null;

        const displayName = rich?.localized_name || schema?.displayName || name;
        const description = rich?.localized_desc || schema?.description || '';

        const toIconUrl = (value: string | undefined): string => {
          if (!value) return '';
          if (value.startsWith('http')) return value;
          const hash = value.endsWith('.jpg') ? value.slice(0, -4) : value;
          return `${this.cdnBase}/${appId}/${hash}.jpg`;
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

      const unlocked = merged.filter((a) => a.achieved).length;
      const elapsed = Date.now() - t0;
      this.perf(`getAchievements(app=${appId})`, elapsed, 3000);
      this.dev(
        `← getAchievements(${appId}) — "${gameName}" | total=${merged.length}` +
        ` | unlocked=${unlocked} | schema=${schemaAchievements.length} rich=${richAchievements.length}` +
        ` | player=${playerAchievements.length} global=${globalPercentages.length} | ${elapsed}ms`,
      );

      return { achievements: merged, gameName };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(
        `getAchievements(app=${appId}, steam=${steamId}) failed after ${Date.now() - t0}ms`,
        (err as Error)?.message,
      );
      throw new HttpException('Failed to fetch achievements from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async getHeaderImage(appId: string): Promise<{ url: string; libraryUrl: string }> {
    const t0 = Date.now();
    this.dev(`→ getHeaderImage(${appId})`);
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
      this.perf(`getHeaderImage(${appId})`, Date.now() - t0);
      this.dev(`← getHeaderImage(${appId}) — ${headerImage}`);
      return { url: headerImage, libraryUrl: headerImage };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getHeaderImage(${appId}) failed after ${Date.now() - t0}ms`, (err as Error)?.message);
      throw new HttpException('Failed to fetch game image from Steam', HttpStatus.BAD_GATEWAY);
    }
  }

  async resolveVanityUrl(vanityUrl: string): Promise<string> {
    const t0 = Date.now();
    this.dev(`→ resolveVanityUrl("${vanityUrl}")`);
    const url = `${this.baseUrl}/ISteamUser/ResolveVanityURL/v0001/`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<ResolveVanityURLResponse>(url, {
          params: { key: this.apiKey, vanityurl: vanityUrl },
        }),
      );

      const result = response.data?.response;
      if (!result || result.success !== 1 || !result.steamid) {
        throw new HttpException(
          result?.message || `Could not resolve vanity URL: ${vanityUrl}`,
          HttpStatus.NOT_FOUND,
        );
      }

      this.perf(`resolveVanityUrl("${vanityUrl}")`, Date.now() - t0);
      this.dev(`← resolveVanityUrl → steamId=${result.steamid}`);
      return result.steamid;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`resolveVanityUrl("${vanityUrl}") failed after ${Date.now() - t0}ms`, err?.message);
      throw new HttpException('Failed to resolve vanity URL from Steam', HttpStatus.BAD_GATEWAY);
    }
  }
}
