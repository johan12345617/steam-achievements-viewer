// ─── Player Summary ───────────────────────────────────────────────────────────

export interface PlayerSummary {
  steamid: string;
  communityvisibilitystate: number;
  profilestate: number;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  avatarhash: string;
  lastlogoff: number;
  personastate: number;
  realname?: string;
  primaryclanid?: string;
  timecreated?: number;
  personastateflags?: number;
  loccountrycode?: string;
  locstatecode?: string;
  loccityid?: number;
}

export interface GetPlayerSummariesResponse {
  response: {
    players: PlayerSummary[];
  };
}

// ─── Owned Games ─────────────────────────────────────────────────────────────

export interface OwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number;
  img_icon_url?: string;
  img_logo_url?: string;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  rtime_last_played?: number;
  has_community_visible_stats?: boolean;
}

export interface GetOwnedGamesResponse {
  response: {
    game_count: number;
    games: OwnedGame[];
  };
}

// ─── Player Achievements ──────────────────────────────────────────────────────

export interface PlayerAchievement {
  apiname: string;
  achieved: number;
  unlocktime: number;
  name?: string;
  description?: string;
}

export interface GetPlayerAchievementsResponse {
  playerstats: {
    steamID: string;
    gameName: string;
    achievements: PlayerAchievement[];
    success: boolean;
    error?: string;
  };
}

// ─── Game Schema ──────────────────────────────────────────────────────────────

export interface SchemaAchievement {
  name: string;
  defaultvalue: number;
  displayName: string;
  hidden: number;
  description?: string;
  icon: string;
  icongray: string;
}

export interface GetSchemaForGameResponse {
  game: {
    gameName?: string;
    gameVersion?: string;
    availableGameStats?: {
      achievements: SchemaAchievement[];
    };
  };
}

// ─── Global Achievement Percentages ──────────────────────────────────────────

export interface GlobalAchievementPercentage {
  name: string;
  percent: number;
}

export interface GetGlobalAchievementPercentagesResponse {
  achievementpercentages: {
    achievements: GlobalAchievementPercentage[];
  };
}

// ─── Merged Achievement (returned by our API) ─────────────────────────────────

export interface MergedAchievement {
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

// ─── IPlayerService/GetGameAchievements/v1 ────────────────────────────────────

export interface GameAchievementEntry {
  internal_name: string;
  localized_name: string;
  localized_desc: string;
  icon: string;
  icon_gray: string;
  hidden: boolean;
  player_percent_unlocked: string; // returned as string by Steam
}

export interface GetGameAchievementsResponse {
  response: {
    achievements?: GameAchievementEntry[];
  };
}

// ─── Vanity URL ───────────────────────────────────────────────────────────────

export interface ResolveVanityURLResponse {
  response: {
    steamid?: string;
    success: number;
    message?: string;
  };
}
