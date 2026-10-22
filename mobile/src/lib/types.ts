export interface Game {
  appid: number;
  name?: string;
  playtime_forever: number;
  rtime_last_played?: number;
  has_community_visible_stats?: boolean;
  achievementsTotal?: number;
  achievementsUnlocked?: number;
  achievementPercentage?: number;
}

export interface Achievement {
  apiName: string;
  displayName: string;
  description: string;
  icon: string;
  iconGray: string;
  achieved: boolean;
  unlockTime: number;
  globalPercent: number | null;
  hidden: boolean;
  points?: number;
  hardcore?: boolean;
}

export interface GameDetail {
  gameName: string;
  achievements: Achievement[];
  error?: string;
}

export interface Dashboard {
  totalGames: number;
  totalAchievements: number;
  unlockedAchievements: number;
  topGamesWithStats: Game[];
  recentUnlocks: { achievement: Achievement; game: Game; unlockedAt: number }[];
  rarestAchievement: Achievement | null;
  rarestAchievementGame: Game | null;
}

export interface RetroGame {
  gameId: number;
  title: string;
  imageIconUrl: string;
  consoleName: string;
  maxPossible: number;
  numAwarded: number;
  numAwardedHardcore: number;
  completionPercentage: number;
  hardcoreCompletionPercentage: number;
  mostRecentAwardedDate: string | null;
}

export interface RetroGamesResponse {
  username: string;
  totalTrackedGames: number;
  gamesWithUnlocks: number;
  games: RetroGame[];
}

export interface RetroGameDetail {
  username: string;
  gameId: number;
  mediaAppId: number;
  title: string;
  consoleName: string;
  imageIconUrl: string;
  imageTitleUrl: string;
  imageBoxArtUrl: string;
  totalAchievements: number;
  unlockedAchievements: number;
  unlockedHardcoreAchievements: number;
  completionPercentage: number;
  achievements: {
    apiName: string;
    title: string;
    description: string;
    points: number;
    badgeUrl: string;
    achieved: boolean;
    unlockTime: number;
    hardcoreAchieved: boolean;
  }[];
}

export interface AchievementMedia {
  id: string;
  achievementApiName: string;
  appId: number;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  caption?: string;
  uploadedAt: string;
}

export type RootStackParams = {
  Home: undefined;
  Game: { game: Game };
  RetroGame: { game: RetroGame; username: string };
  Achievement: { achievement: Achievement; gameName: string; appId: number };
};
