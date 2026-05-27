import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  RetroAchievement,
  RetroAchievementsCompletionGame,
  RetroAchievementsCompletionResponse,
  RetroAchievementsGameProgressAchievement,
  RetroAchievementsGameProgressResponse,
  RetroGame,
  RetroGameDetail,
  RetroGamesResponse,
} from './dto/retroachievements-response.dto';

@Injectable()
export class RetroAchievementsService {
  private readonly logger = new Logger(RetroAchievementsService.name);
  private readonly baseUrl = 'https://retroachievements.org';
  private readonly mediaBaseUrl = 'https://media.retroachievements.org';
  private readonly mediaAppIdOffset = 900000000;
  private readonly cache = new Map<string, { data: RetroGamesResponse; expiresAt: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private readonly pageSize = 500;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('RETROACHIEVEMENTS_API_KEY');
    if (!key) {
      throw new HttpException(
        'RETROACHIEVEMENTS_API_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return key;
  }

  async getGamesWithUnlocks(username: string): Promise<RetroGamesResponse> {
    const cleanUsername = username.trim();
    if (!this.isValidUserIdentifier(cleanUsername)) {
      throw new HttpException('Invalid RetroAchievements username or ULID', HttpStatus.BAD_REQUEST);
    }

    const cacheKey = cleanUsername.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
    this.cache.delete(cacheKey);

    const games = await this.fetchAllCompletionProgress(cleanUsername);
    const gamesWithUnlocks = games
      .filter((game) => game.NumAwarded > 0 || game.NumAwardedHardcore > 0)
      .map((game) => this.mapGame(game))
      .sort((a, b) => {
        const bDate = Date.parse(b.mostRecentAwardedDate ?? '') || 0;
        const aDate = Date.parse(a.mostRecentAwardedDate ?? '') || 0;
        return bDate - aDate || a.title.localeCompare(b.title);
      });

    const result: RetroGamesResponse = {
      username: cleanUsername,
      totalTrackedGames: games.length,
      gamesWithUnlocks: gamesWithUnlocks.length,
      games: gamesWithUnlocks,
    };

    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + this.cacheTtlMs });
    return result;
  }

  async getGameProgress(username: string, gameId: number): Promise<RetroGameDetail> {
    const cleanUsername = username.trim();
    if (!this.isValidUserIdentifier(cleanUsername)) {
      throw new HttpException('Invalid RetroAchievements username or ULID', HttpStatus.BAD_REQUEST);
    }
    if (!Number.isInteger(gameId) || gameId <= 0) {
      throw new HttpException('gameId must be a valid positive number', HttpStatus.BAD_REQUEST);
    }

    const response = await this.fetchGameProgress(cleanUsername, gameId);
    if (response.Error || response.Success === false) {
      throw new HttpException(
        response.Error || 'Failed to fetch RetroAchievements game progress',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const responseAny = response as any;
    const gameIdFromResponse = Number(responseAny.ID ?? responseAny.id);
    const achievements = (Object.values(
      responseAny.Achievements ?? responseAny.achievements ?? {},
    ) as RetroAchievementsGameProgressAchievement[])
      .map((achievement) => this.mapAchievement(achievement))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));

    const totalAchievements = Number(responseAny.NumAchievements ?? responseAny.numAchievements ?? achievements.length);
    const unlockedAchievements = Number(
      responseAny.NumAwardedToUser ?? responseAny.numAwardedToUser ?? achievements.filter((a) => a.achieved).length,
    );
    const unlockedHardcoreAchievements = Number(
      responseAny.NumAwardedToUserHardcore ??
        responseAny.numAwardedToUserHardcore ??
        achievements.filter((a) => a.hardcoreAchieved).length,
    );

    return {
      username: cleanUsername,
      gameId: gameIdFromResponse,
      mediaAppId: this.toMediaAppId(gameIdFromResponse),
      title: responseAny.Title ?? responseAny.title ?? '',
      consoleId: Number(responseAny.ConsoleID ?? responseAny.consoleId ?? 0),
      consoleName: responseAny.ConsoleName ?? responseAny.consoleName ?? '',
      imageIconUrl: this.toAbsoluteImageUrl(responseAny.ImageIcon ?? responseAny.imageIcon),
      imageTitleUrl: this.toAbsoluteImageUrl(responseAny.ImageTitle ?? responseAny.imageTitle),
      imageIngameUrl: this.toAbsoluteImageUrl(responseAny.ImageIngame ?? responseAny.imageIngame),
      imageBoxArtUrl: this.toAbsoluteImageUrl(responseAny.ImageBoxArt ?? responseAny.imageBoxArt),
      publisher: responseAny.Publisher ?? responseAny.publisher ?? '',
      developer: responseAny.Developer ?? responseAny.developer ?? '',
      genre: responseAny.Genre ?? responseAny.genre ?? '',
      released: responseAny.Released ?? responseAny.released ?? '',
      totalAchievements,
      unlockedAchievements,
      unlockedHardcoreAchievements,
      completionPercentage: this.toPercentage(unlockedAchievements, totalAchievements),
      hardcoreCompletionPercentage: this.toPercentage(unlockedHardcoreAchievements, totalAchievements),
      highestAwardKind: responseAny.HighestAwardKind ?? responseAny.highestAwardKind ?? null,
      highestAwardDate: responseAny.HighestAwardDate ?? responseAny.highestAwardDate ?? null,
      achievements,
    };
  }

  private async fetchAllCompletionProgress(username: string): Promise<RetroAchievementsCompletionGame[]> {
    const allGames: RetroAchievementsCompletionGame[] = [];
    let total = 0;

    for (let offset = 0; offset <= total || offset === 0; offset += this.pageSize) {
      const response = await this.fetchCompletionPage(username, offset);
      if (response.Error || response.Success === false) {
        throw new HttpException(
          response.Error || 'Failed to fetch RetroAchievements completion progress',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const results = response.Results ?? [];
      total = Number(response.Total ?? results.length);
      allGames.push(...results);

      if (results.length === 0 || allGames.length >= total) {
        break;
      }
    }

    return allGames;
  }

  private async fetchCompletionPage(
    username: string,
    offset: number,
  ): Promise<RetroAchievementsCompletionResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<RetroAchievementsCompletionResponse>(
          `${this.baseUrl}/API/API_GetUserCompletionProgress.php`,
          {
            params: {
              y: this.apiKey,
              u: username,
              c: this.pageSize,
              o: offset,
            },
          },
        ),
      );

      return response.data;
    } catch (err) {
      this.logger.error(
        `RetroAchievements completion progress failed for ${username}`,
        (err as Error)?.message,
      );
      throw new HttpException(
        'Failed to fetch RetroAchievements completion progress',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async fetchGameProgress(
    username: string,
    gameId: number,
  ): Promise<RetroAchievementsGameProgressResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<RetroAchievementsGameProgressResponse>(
          `${this.baseUrl}/API/API_GetGameInfoAndUserProgress.php`,
          {
            params: {
              y: this.apiKey,
              u: username,
              g: gameId,
            },
          },
        ),
      );

      return response.data;
    } catch (err) {
      this.logger.error(
        `RetroAchievements game progress failed for ${username}/${gameId}`,
        (err as Error)?.message,
      );
      throw new HttpException(
        'Failed to fetch RetroAchievements game progress',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private mapGame(game: RetroAchievementsCompletionGame): RetroGame {
    const maxPossible = Number(game.MaxPossible ?? 0);
    const numAwarded = Number(game.NumAwarded ?? 0);
    const numAwardedHardcore = Number(game.NumAwardedHardcore ?? 0);

    return {
      gameId: game.GameID,
      title: game.Title,
      imageIconUrl: this.toAbsoluteImageUrl(game.ImageIcon),
      consoleId: game.ConsoleID,
      consoleName: game.ConsoleName,
      maxPossible,
      numAwarded,
      numAwardedHardcore,
      completionPercentage: this.toPercentage(numAwarded, maxPossible),
      hardcoreCompletionPercentage: this.toPercentage(numAwardedHardcore, maxPossible),
      mostRecentAwardedDate: game.MostRecentAwardedDate,
      highestAwardKind: game.HighestAwardKind,
      highestAwardDate: game.HighestAwardDate,
      gameUrl: `${this.baseUrl}/game/${game.GameID}`,
    };
  }

  private mapAchievement(achievement: RetroAchievementsGameProgressAchievement): RetroAchievement {
    const achievementAny = achievement as any;
    const achievementId = Number(achievementAny.id ?? achievementAny.ID);
    const unlockDate = achievementAny.dateEarned ?? achievementAny.DateEarned ?? null;
    const hardcoreUnlockDate = achievementAny.dateEarnedHardcore ?? achievementAny.DateEarnedHardcore ?? null;
    const badgeName = String(achievementAny.badgeName ?? achievementAny.BadgeName ?? '');

    return {
      achievementId,
      apiName: this.toAchievementApiName(achievementId),
      title: achievementAny.title ?? achievementAny.Title ?? '',
      description: achievementAny.description ?? achievementAny.Description ?? '',
      points: Number(achievementAny.points ?? achievementAny.Points ?? 0),
      trueRatio: Number(achievementAny.trueRatio ?? achievementAny.TrueRatio ?? 0),
      badgeName,
      badgeUrl: this.toBadgeUrl(badgeName),
      achieved: Boolean(unlockDate),
      unlockTime: unlockDate ? Math.floor(Date.parse(`${unlockDate.replace(' ', 'T')}Z`) / 1000) : 0,
      unlockDate,
      hardcoreAchieved: Boolean(hardcoreUnlockDate),
      hardcoreUnlockDate,
      numAwarded: Number(achievementAny.numAwarded ?? achievementAny.NumAwarded ?? 0),
      numAwardedHardcore: Number(achievementAny.numAwardedHardcore ?? achievementAny.NumAwardedHardcore ?? 0),
      displayOrder: Number(achievementAny.displayOrder ?? achievementAny.DisplayOrder ?? 0),
      type: achievementAny.type ?? achievementAny.Type ?? null,
    };
  }

  private toAbsoluteImageUrl(imageIcon: string | null | undefined): string {
    if (!imageIcon) return '';
    if (imageIcon.startsWith('http')) return imageIcon;
    return `${this.mediaBaseUrl}${imageIcon.startsWith('/') ? '' : '/'}${imageIcon}`;
  }

  private toBadgeUrl(badgeName: string): string {
    const safeBadgeName = badgeName.trim();
    if (!safeBadgeName) return '';
    return `${this.mediaBaseUrl}/Badge/${safeBadgeName}.png`;
  }

  private toMediaAppId(gameId: number): number {
    return this.mediaAppIdOffset + gameId;
  }

  private toAchievementApiName(achievementId: number): string {
    return `ra_${achievementId}`;
  }

  private toPercentage(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  private isValidUserIdentifier(value: string): boolean {
    return /^[a-zA-Z0-9_-]{2,32}$/.test(value) || /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
  }
}
