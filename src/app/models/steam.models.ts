export interface PlayerSummary {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatarUrl: string;
  avatarMediumUrl: string;
  avatarFullUrl: string;
  personaState: number; // 0=Offline, 1=Online, 2=Busy, 3=Away, 4=Snooze, 5=Looking to trade, 6=Looking to play
  countryCode?: string;
  lastLogOff?: number;
  timeCreated?: number;
}

export interface OwnedGame {
  appId: number;
  name: string;
  playtimeForever: number; // minutes
  playtime2Weeks?: number; // minutes
  imgIconUrl: string;
  imgLogoUrl: string;
  hasCommunityVisibleStats: boolean;
  lastPlayed?: number; // Unix timestamp
  achievementsTotal?: number;
  achievementsUnlocked?: number;
  achievementPercentage?: number;
}

export interface PlayerAchievement {
  apiName: string;
  achieved: number; // 0 or 1
  unlockTime: number; // Unix timestamp (0 if not achieved)
  name?: string;
  description?: string;
}

export interface GameAchievementSchema {
  name: string;
  displayName: string;
  hidden: number; // 0 or 1
  description?: string;
  icon: string;
  iconGray: string;
}

export interface Achievement {
  apiName: string;
  name: string;
  description: string;
  icon: string;
  iconGray: string;
  achieved: boolean;
  unlockTime: number | null;
  globalPercentage?: number;
  hidden: boolean;
  media?: AchievementMedia[];
}

export interface AchievementMedia {
  id: string;
  achievementApiName: string;
  appId: number;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt: Date;
}

export interface GameStats {
  appId: number;
  name: string;
  imgIconUrl: string;
  imgLogoUrl: string;
  playtimeForever: number;
  achievements: Achievement[];
  totalAchievements: number;
  unlockedAchievements: number;
  percentage: number;
}

export interface DashboardStats {
  totalGames: number;
  totalAchievements: number;
  unlockedAchievements: number;
  unlockRate: number;
  rarestAchievement: Achievement | null;
  rarestAchievementGame: OwnedGame | null;
  recentUnlocks: RecentUnlock[];
}

export interface RecentUnlock {
  achievement: Achievement;
  game: OwnedGame;
  unlockedAt: Date;
}

export interface MediaUploadPayload {
  achievementApiName: string;
  appId: number;
  file: File;
  type: 'image' | 'video';
  caption?: string;
}
