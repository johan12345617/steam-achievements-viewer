export interface RetroAchievementsCompletionGame {
  GameID: number;
  Title: string;
  ImageIcon: string;
  ConsoleID: number;
  ConsoleName: string;
  MaxPossible: number;
  NumAwarded: number;
  NumAwardedHardcore: number;
  MostRecentAwardedDate: string | null;
  HighestAwardKind: string | null;
  HighestAwardDate: string | null;
}

export interface RetroAchievementsCompletionResponse {
  Count: number;
  Total: number;
  Results: RetroAchievementsCompletionGame[];
  Error?: string;
  Success?: boolean;
}

export interface RetroGame {
  gameId: number;
  title: string;
  imageIconUrl: string;
  consoleId: number;
  consoleName: string;
  maxPossible: number;
  numAwarded: number;
  numAwardedHardcore: number;
  completionPercentage: number;
  hardcoreCompletionPercentage: number;
  mostRecentAwardedDate: string | null;
  highestAwardKind: string | null;
  highestAwardDate: string | null;
  gameUrl: string;
}

export interface RetroGamesResponse {
  username: string;
  totalTrackedGames: number;
  gamesWithUnlocks: number;
  games: RetroGame[];
}

export interface RetroAchievementsGameProgressAchievement {
  id: number;
  numAwarded: number;
  numAwardedHardcore: number;
  title: string;
  description: string;
  points: number;
  trueRatio: number;
  author: string;
  dateModified: string;
  dateCreated: string;
  badgeName: string;
  displayOrder: number;
  type?: string | null;
  dateEarned?: string;
  dateEarnedHardcore?: string;
}

export interface RetroAchievementsGameProgressResponse {
  ID: number;
  Title: string;
  ConsoleID: number;
  ConsoleName: string;
  ImageIcon: string;
  ImageTitle?: string;
  ImageIngame?: string;
  ImageBoxArt?: string;
  Publisher?: string;
  Developer?: string;
  Genre?: string;
  Released?: string;
  NumAchievements: number;
  Achievements?: Record<string, RetroAchievementsGameProgressAchievement>;
  UserCompletion?: string;
  UserCompletionHardcore?: string;
  NumAwardedToUser?: number;
  NumAwardedToUserHardcore?: number;
  HighestAwardKind?: string | null;
  HighestAwardDate?: string | null;
  Error?: string;
  Success?: boolean;
}

export interface RetroAchievement {
  achievementId: number;
  apiName: string;
  title: string;
  description: string;
  points: number;
  trueRatio: number;
  badgeName: string;
  badgeUrl: string;
  achieved: boolean;
  unlockTime: number;
  unlockDate: string | null;
  hardcoreAchieved: boolean;
  hardcoreUnlockDate: string | null;
  numAwarded: number;
  numAwardedHardcore: number;
  displayOrder: number;
  type: string | null;
}

export interface RetroGameDetail {
  username: string;
  gameId: number;
  mediaAppId: number;
  title: string;
  consoleId: number;
  consoleName: string;
  imageIconUrl: string;
  imageTitleUrl: string;
  imageIngameUrl: string;
  imageBoxArtUrl: string;
  publisher: string;
  developer: string;
  genre: string;
  released: string;
  totalAchievements: number;
  unlockedAchievements: number;
  unlockedHardcoreAchievements: number;
  completionPercentage: number;
  hardcoreCompletionPercentage: number;
  highestAwardKind: string | null;
  highestAwardDate: string | null;
  achievements: RetroAchievement[];
}
