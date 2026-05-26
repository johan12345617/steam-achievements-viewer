import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map, forkJoin, catchError, tap, shareReplay } from 'rxjs';
import {
  PlayerSummary,
  OwnedGame,
  GameStats,
  Achievement,
  DashboardStats,
  RecentUnlock,
} from '../models/steam.models';
import { environment } from '../../environments/environment';

// Shapes returned by the backend (mirrors backend DTOs)
interface BackendPlayer {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  loccountrycode?: string;
  lastlogoff: number;
  timecreated?: number;
  personastate: number;
}

interface BackendGame {
  appid: number;
  name?: string;
  playtime_forever: number;
  img_icon_url?: string;
  img_logo_url?: string;
  has_community_visible_stats?: boolean;
  rtime_last_played?: number;
  achievementsTotal?: number;
  achievementsUnlocked?: number;
  achievementPercentage?: number;
}

interface BackendMergedAchievement {
  apiName: string;
  displayName: string;
  description: string;
  icon: string;
  iconGray: string;
  achieved: boolean;
  unlockTime: number;
  globalPercent: number | null;
  hidden: boolean;
}

interface BackendAchievementsResponse {
  achievements: BackendMergedAchievement[];
  gameName: string;
  error?: string;
}

interface BackendDashboardResponse {
  totalGames: number;
  totalAchievements: number;
  unlockedAchievements: number;
  topGamesWithStats: (BackendGame & { achievementsTotal: number; achievementsUnlocked: number; achievementPercentage: number })[];
  recentUnlocks: { achievement: BackendMergedAchievement; game: BackendGame; unlockedAt: number }[];
  rarestAchievement: BackendMergedAchievement | null;
  rarestAchievementGame: BackendGame | null;
}

interface BackendSessionUser {
  steamId: string;
  displayName: string;
  avatar: string;
}

@Injectable({
  providedIn: 'root',
})
export class SteamService {
  private http = inject(HttpClient);
  private api = environment.apiBase;

  currentSteamId = signal<string>('');
  currentPlayerName = signal<string>('');
  currentPlayerInfo = signal<PlayerSummary>({
    steamId: "",
    personaName: "",
    profileUrl: "",
    avatarUrl: "",
    avatarMediumUrl: "",
    avatarFullUrl: "",
    personaState: 0
  });

  // Request-level cache: avoids duplicate HTTP calls when multiple components load the same data
  private readonly ownedGamesCache = new Map<string, Observable<OwnedGame[]>>();
  private readonly basicGamesCache = new Map<string, Observable<OwnedGame[]>>();
  private restoreSessionRequest?: Observable<boolean>;

  // ============================================================
  // MOCK DATA
  // ============================================================

  private mockPlayer: PlayerSummary = {
    steamId: '76561198000000001',
    personaName: 'SteamPlayer42',
    profileUrl: 'https://steamcommunity.com/profiles/76561198000000001',
    avatarUrl: '',
    avatarMediumUrl: '',
    avatarFullUrl: '',
    personaState: 1,
    countryCode: 'US',
    lastLogOff: Math.floor(Date.now() / 1000) - 3600,
    timeCreated: 1200000000,
  };

  private mockGames: OwnedGame[] = [
    {
      appId: 220,
      name: 'Half-Life 2',
      playtimeForever: 1820,
      imgIconUrl: 'hl2',
      imgLogoUrl: 'hl2',
      hasCommunityVisibleStats: true,
      achievementsTotal: 5,
      achievementsUnlocked: 4,
      achievementPercentage: 80,
    },
    {
      appId: 620,
      name: 'Portal 2',
      playtimeForever: 960,
      imgIconUrl: 'portal2',
      imgLogoUrl: 'portal2',
      hasCommunityVisibleStats: true,
      achievementsTotal: 6,
      achievementsUnlocked: 3,
      achievementPercentage: 50,
    },
    {
      appId: 730,
      name: 'Counter-Strike 2',
      playtimeForever: 14400,
      imgIconUrl: 'cs2',
      imgLogoUrl: 'cs2',
      hasCommunityVisibleStats: true,
      achievementsTotal: 5,
      achievementsUnlocked: 2,
      achievementPercentage: 40,
    },
    {
      appId: 440,
      name: 'Team Fortress 2',
      playtimeForever: 3200,
      imgIconUrl: 'tf2',
      imgLogoUrl: 'tf2',
      hasCommunityVisibleStats: true,
      achievementsTotal: 6,
      achievementsUnlocked: 6,
      achievementPercentage: 100,
    },
  ];

  private mockAchievements: Record<number, Achievement[]> = {
    220: [
      {
        apiName: 'HL2_KILL_ROLLERMINE',
        name: 'Trusty Hardware',
        description: 'Kill a rollermine with the gravgun.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 30,
        globalPercentage: 72.4,
        hidden: false,
      },
      {
        apiName: 'HL2_BEAT_GAME',
        name: 'Escape from City 17',
        description: 'Escape City 17 with Alyx.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 25,
        globalPercentage: 54.1,
        hidden: false,
      },
      {
        apiName: 'HL2_KILL_CHOPPER',
        name: 'Gunship Kill',
        description: 'Destroy the gunship in the bridge battle.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 20,
        globalPercentage: 44.8,
        hidden: false,
      },
      {
        apiName: 'HL2_KILL_STRIDER',
        name: 'Strider Hunter',
        description: 'Destroy all the striders in the finale without the vehicle.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 10,
        globalPercentage: 18.2,
        hidden: false,
      },
      {
        apiName: 'HL2_BEAT_RAVENHOLM',
        name: 'Zombie Chopper',
        description: 'Play through Ravenholm only using the gravity gun.',
        icon: '',
        iconGray: '',
        achieved: false,
        unlockTime: null,
        globalPercentage: 12.7,
        hidden: false,
      },
    ],
    620: [
      {
        apiName: 'PORTAL2_SP_TBEAM_CATCH',
        name: 'Catch the Cube',
        description: 'Catch a cube dropped by a tractor beam.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 15,
        globalPercentage: 67.3,
        hidden: false,
      },
      {
        apiName: 'PORTAL2_SP_BEAT_GAME',
        name: 'A Chell of a Fellow',
        description: 'Complete the single player campaign.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 14,
        globalPercentage: 58.9,
        hidden: false,
      },
      {
        apiName: 'PORTAL2_SP_FALL_400',
        name: 'Pit Boss',
        description: 'Fall 400 feet without dying.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 5,
        globalPercentage: 41.5,
        hidden: false,
      },
      {
        apiName: 'PORTAL2_SP_TBEAM_WALK',
        name: 'Tractor Beam Rider',
        description: 'Ride a tractor beam for 30 seconds.',
        icon: '',
        iconGray: '',
        achieved: false,
        unlockTime: null,
        globalPercentage: 29.8,
        hidden: false,
      },
      {
        apiName: 'PORTAL2_SP_LASER_REDIRECT',
        name: "I'm Helping!",
        description: 'Redirect a laser into all 4 quadrants in one puzzle.',
        icon: '',
        iconGray: '',
        achieved: false,
        unlockTime: null,
        globalPercentage: 22.1,
        hidden: false,
      },
      {
        apiName: 'PORTAL2_COOP_BEAT_GAME',
        name: 'Friends Forever',
        description: 'Complete the co-op campaign.',
        icon: '',
        iconGray: '',
        achieved: false,
        unlockTime: null,
        globalPercentage: 35.4,
        hidden: false,
      },
    ],
    730: [
      {
        apiName: 'CS2_WIN_FIRST_ROUND',
        name: 'First Bullet',
        description: 'Win your first competitive round.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 60,
        globalPercentage: 89.2,
        hidden: false,
      },
      {
        apiName: 'CS2_KNIFE_KILL',
        name: 'Knife Fighter',
        description: 'Get a kill with the knife in a competitive match.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 45,
        globalPercentage: 55.7,
        hidden: false,
      },
      {
        apiName: 'CS2_DEFUSE_BOMB',
        name: 'Defusing the Situation',
        description: 'Defuse the bomb while the CT side.',
        icon: '',
        iconGray: '',
        achieved: false,
        unlockTime: null,
        globalPercentage: 47.3,
        hidden: false,
      },
      {
        apiName: 'CS2_ACE_ROUND',
        name: 'Ace!',
        description: 'Kill all 5 enemies in a single round.',
        icon: '',
        iconGray: '',
        achieved: false,
        unlockTime: null,
        globalPercentage: 23.6,
        hidden: false,
      },
      {
        apiName: 'CS2_WIN_PISTOL_ROUND',
        name: 'Pistol Pete',
        description: 'Win a pistol round with only a pistol.',
        icon: '',
        iconGray: '',
        achieved: false,
        unlockTime: null,
        globalPercentage: 38.1,
        hidden: false,
      },
    ],
    440: [
      {
        apiName: 'TF2_PYRO_KILL',
        name: 'Trial by Fire',
        description: 'Kill 100 players with the flamethrower as Pyro.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 100,
        globalPercentage: 62.3,
        hidden: false,
      },
      {
        apiName: 'TF2_MEDIC_HEAL',
        name: 'Peer Pressure',
        description: 'Heal a teammate who is taking fire for 5 seconds.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 90,
        globalPercentage: 48.7,
        hidden: false,
      },
      {
        apiName: 'TF2_SNIPER_HEADSHOT',
        name: 'Sharpshooter',
        description: 'Get 10 headshots in a single round as Sniper.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 70,
        globalPercentage: 31.5,
        hidden: false,
      },
      {
        apiName: 'TF2_ENGINEER_BUILD',
        name: 'Texas Two-Step',
        description: 'Build 50 sentries as Engineer.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 50,
        globalPercentage: 44.2,
        hidden: false,
      },
      {
        apiName: 'TF2_SPY_BACKSTAB',
        name: 'Cloak and Dagger',
        description: 'Backstab 10 players in a single life as Spy.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 40,
        globalPercentage: 19.8,
        hidden: false,
      },
      {
        apiName: 'TF2_HEAVY_MEATSHOT',
        name: 'Meatshot',
        description: 'Deal 1000 damage in a single life as Heavy.',
        icon: '',
        iconGray: '',
        achieved: true,
        unlockTime: Math.floor(Date.now() / 1000) - 86400 * 20,
        globalPercentage: 27.4,
        hidden: false,
      },
    ],
  };

  // ============================================================
  // MAPPERS  (backend shape → frontend model)
  // ============================================================

  private mapPlayer(p: BackendPlayer, steamId: string): PlayerSummary {
    return {
      steamId: p.steamid ?? steamId,
      personaName: p.personaname,
      profileUrl: p.profileurl,
      avatarUrl: p.avatar,
      avatarMediumUrl: p.avatarmedium,
      avatarFullUrl: p.avatarfull,
      personaState: p.personastate,
      countryCode: p.loccountrycode,
      lastLogOff: p.lastlogoff,
      timeCreated: p.timecreated,
    };
  }

  private mapGame(g: BackendGame): OwnedGame {
    return {
      appId: g.appid,
      name: g.name ?? `App ${g.appid}`,
      playtimeForever: g.playtime_forever,
      imgIconUrl: g.img_icon_url ?? '',
      imgLogoUrl: g.img_logo_url ?? '',
      hasCommunityVisibleStats: g.has_community_visible_stats ?? false,
      lastPlayed: g.rtime_last_played,
      achievementsTotal: g.achievementsTotal ?? 0,
      achievementsUnlocked: g.achievementsUnlocked ?? 0,
      achievementPercentage: g.achievementPercentage ?? 0,
    };
  }

  private mapAchievement(a: BackendMergedAchievement): Achievement {
    return {
      apiName: a.apiName,
      name: a.displayName,
      description: a.description,
      icon: a.icon,
      iconGray: a.iconGray,
      achieved: a.achieved,
      unlockTime: a.unlockTime > 0 ? a.unlockTime : null,
      globalPercentage: a.globalPercent ?? undefined,
      hidden: a.hidden,
    };
  }

  // ============================================================
  // PUBLIC API METHODS
  // ============================================================

  getPlayerSummary(steamId: string): Observable<PlayerSummary> {
    if (environment.offlineMode) {
      const player = { ...this.mockPlayer, steamId, personaName: this.currentPlayerName() || 'SteamPlayer42' };
      this.currentPlayerInfo.set(player);
      return of(player).pipe(delay(400));
    }
    if(this.currentPlayerInfo().steamId!== ""){
      return of(this.currentPlayerInfo());
    }
    //cache profile info until user logout
    return this.http.get<BackendPlayer>(`${this.api}/steam/player/${steamId}`).pipe(
      map((p) => this.mapPlayer(p, steamId)),
      tap((player) => this.currentPlayerInfo.set(player)) // cache it
    );
  }

  loginWithSteam(): void {
    window.location.href = `${this.api}/auth/steam`;
  }

  restoreSession(): Observable<boolean> {
    if (this.currentSteamId()) {
      return of(true);
    }

    if (!this.restoreSessionRequest) {
      this.restoreSessionRequest = this.http.get<BackendSessionUser>(`${this.api}/auth/me`, { withCredentials: true }).pipe(
        tap((user) => {
          this.currentSteamId.set(user.steamId);
          this.currentPlayerName.set(user.displayName);
          this.currentPlayerInfo.set({
            steamId: user.steamId,
            personaName: user.displayName,
            profileUrl: `https://steamcommunity.com/profiles/${user.steamId}`,
            avatarUrl: user.avatar,
            avatarMediumUrl: user.avatar,
            avatarFullUrl: user.avatar,
            personaState: 0,
          });
        }),
        map(() => true),
        catchError(() => of(false)),
        shareReplay(1),
      );
    }

    return this.restoreSessionRequest;
  }

  logout(): Observable<void> {
    const steamId = this.currentSteamId();
    if (steamId) {
      this.clearCache(steamId);
    }
    this.currentSteamId.set('');
    this.currentPlayerName.set('');
    this.currentPlayerInfo.set({
      steamId: '',
      personaName: '',
      profileUrl: '',
      avatarUrl: '',
      avatarMediumUrl: '',
      avatarFullUrl: '',
      personaState: 0,
    });
    this.restoreSessionRequest = undefined;
    return this.http.post<{ ok: boolean }>(`${this.api}/auth/logout`, {}, { withCredentials: true }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /** Fast: returns owned games without achievement stats (one Steam API call). */
  getBasicGames(steamId: string): Observable<OwnedGame[]> {
    if (environment.offlineMode) {
      return of(this.mockGames).pipe(delay(300));
    }
    if (!this.basicGamesCache.has(steamId)) {
      const req$ = this.http.get<BackendGame[]>(`${this.api}/steam/games/${steamId}`).pipe(
        map((games) => games.map((g) => this.mapGame(g))),
        shareReplay(1),
      );
      this.basicGamesCache.set(steamId, req$);
    }
    return this.basicGamesCache.get(steamId)!;
  }

  /** Slow on first call: returns games with achievement counts. Result is cached server-side for 5 min. */
  getOwnedGames(steamId: string): Observable<OwnedGame[]> {
    if (environment.offlineMode) {
      return of(this.mockGames).pipe(delay(600));
    }
    if (!this.ownedGamesCache.has(steamId)) {
      const req$ = this.http.get<BackendGame[]>(`${this.api}/steam/games-with-stats/${steamId}`).pipe(
        map((games) => games.map((g) => this.mapGame(g))),
        shareReplay(1),
      );
      this.ownedGamesCache.set(steamId, req$);
    }
    return this.ownedGamesCache.get(steamId)!;
  }

  /** Call this on logout to clear cached data for the user. */
  clearCache(steamId: string): void {
    this.ownedGamesCache.delete(steamId);
    this.basicGamesCache.delete(steamId);
  }

  getPlayerAchievements(appId: number, steamId: string): Observable<Achievement[]> {
    if (environment.offlineMode) {
      return of(this.mockAchievements[appId] ?? []).pipe(delay(500));
    }
    return this.http.get<BackendAchievementsResponse>(`${this.api}/steam/achievements/${appId}/${steamId}`).pipe(
      map((res) => res.achievements.map((a) => this.mapAchievement(a))),
    );
  }

  getGameStats(appId: number, steamId: string): Observable<GameStats> {
    if (environment.offlineMode) {
      const game = this.mockGames.find((g) => g.appId === appId);
      const achievements = this.mockAchievements[appId] ?? [];
      const unlocked = achievements.filter((a) => a.achieved).length;
      return of({
        appId,
        name: game?.name ?? 'Unknown Game',
        imgIconUrl: game?.imgIconUrl ?? '',
        imgLogoUrl: game?.imgLogoUrl ?? '',
        playtimeForever: game?.playtimeForever ?? 0,
        achievements,
        totalAchievements: achievements.length,
        unlockedAchievements: unlocked,
        percentage: achievements.length > 0 ? Math.round((unlocked / achievements.length) * 100) : 0,
      } as GameStats).pipe(delay(500));
    }

    return forkJoin({
      achievementsRes: this.http.get<BackendAchievementsResponse>(`${this.api}/steam/achievements/${appId}/${steamId}`),
      gamesRes: this.http.get<BackendGame[]>(`${this.api}/steam/games/${steamId}`),
    }).pipe(
      map(({ achievementsRes, gamesRes }) => {
        const achievements = achievementsRes.achievements.map((a) => this.mapAchievement(a));
        const unlocked = achievements.filter((a) => a.achieved).length;
        const game = gamesRes.find((g) => g.appid === appId);
        return {
          appId,
          name: achievementsRes.gameName || game?.name || `App ${appId}`,
          imgIconUrl: game?.img_icon_url ?? '',
          imgLogoUrl: game?.img_logo_url ?? '',
          playtimeForever: game?.playtime_forever ?? 0,
          achievements,
          totalAchievements: achievements.length,
          unlockedAchievements: unlocked,
          percentage: achievements.length > 0 ? Math.round((unlocked / achievements.length) * 100) : 0,
        } as GameStats;
      }),
    );
  }

  getDashboardData(steamId: string): Observable<{ stats: DashboardStats; topGames: OwnedGame[] }> {
    if (environment.offlineMode) {
      const allAchievements = Object.values(this.mockAchievements).flat();
      const unlocked = allAchievements.filter((a) => a.achieved);
      const unlockRate = allAchievements.length > 0
        ? Math.round((unlocked.length / allAchievements.length) * 100) : 0;
      const rarestAchievement = unlocked
        .filter((a) => a.globalPercentage !== undefined)
        .sort((a, b) => (a.globalPercentage ?? 100) - (b.globalPercentage ?? 100))[0] ?? null;
      const recentUnlocks: RecentUnlock[] = unlocked
        .sort((a, b) => (b.unlockTime ?? 0) - (a.unlockTime ?? 0))
        .slice(0, 5)
        .map((a) => {
          const game = this.mockGames.find((g) =>
            this.mockAchievements[g.appId]?.some((ach) => ach.apiName === a.apiName),
          )!;
          return { achievement: a, game, unlockedAt: new Date((a.unlockTime ?? 0) * 1000) };
        });
      return of({
        stats: {
          totalGames: this.mockGames.length,
          totalAchievements: allAchievements.length,
          unlockedAchievements: unlocked.length,
          unlockRate,
          rarestAchievement,
          rarestAchievementGame: null,
          recentUnlocks,
        } as DashboardStats,
        topGames: this.mockGames,
      }).pipe(delay(600));
    }

    return this.http.get<BackendDashboardResponse>(`${this.api}/steam/dashboard/${steamId}`).pipe(
      map((res) => {
        const unlockRate = res.totalAchievements > 0
          ? Math.round((res.unlockedAchievements / res.totalAchievements) * 100) : 0;

        const recentUnlocks: RecentUnlock[] = res.recentUnlocks.map((u) => ({
          achievement: this.mapAchievement(u.achievement),
          game: this.mapGame(u.game),
          unlockedAt: new Date((u.unlockedAt ?? 0) * 1000),
        }));

        return {
          stats: {
            totalGames: res.totalGames,
            totalAchievements: res.totalAchievements,
            unlockedAchievements: res.unlockedAchievements,
            unlockRate,
            rarestAchievement: res.rarestAchievement ? this.mapAchievement(res.rarestAchievement) : null,
            rarestAchievementGame: res.rarestAchievementGame ? this.mapGame(res.rarestAchievementGame) : null,
            recentUnlocks,
          } as DashboardStats,
          topGames: res.topGamesWithStats.map((g) => this.mapGame(g)),
        };
      }),
    );
  }

  /** Resolve a vanity URL (e.g. "gaben") to a 64-bit Steam ID. */
  resolveVanityUrl(vanityUrl: string): Observable<string> {
    if (environment.offlineMode) {
      return of('76561198000000001').pipe(delay(300));
    }
    return this.http.get<{ steamId: string }>(`${this.api}/steam/resolve/${vanityUrl}`).pipe(
      map((res) => res.steamId),
    );
  }

  validateSteamId(steamId: string): boolean {
    const numericId = /^\d{17}$/;
    const vanityUrl = /^[a-zA-Z0-9_-]{2,32}$/;
    return numericId.test(steamId) || vanityUrl.test(steamId);
  }

  formatPlaytime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  formatUnlockDate(unixTimestamp: number): string {
    return new Date(unixTimestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  
}
