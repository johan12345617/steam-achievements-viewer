import { Achievement, Dashboard, Game, RetroGameDetail, RetroGamesResponse } from './types';

export const demoGames: Game[] = [
  { appid: 620, name: 'Portal 2', playtime_forever: 1612, achievementsTotal: 6, achievementsUnlocked: 4, achievementPercentage: 67, has_community_visible_stats: true, rtime_last_played: 1729101600 },
  { appid: 220, name: 'Half-Life 2', playtime_forever: 1940, achievementsTotal: 6, achievementsUnlocked: 6, achievementPercentage: 100, has_community_visible_stats: true, rtime_last_played: 1729015200 },
  { appid: 440, name: 'Team Fortress 2', playtime_forever: 7840, achievementsTotal: 6, achievementsUnlocked: 2, achievementPercentage: 33, has_community_visible_stats: true, rtime_last_played: 1728928800 },
];

export function demoAchievements(appId: number): Achievement[] {
  const titles = appId === 620
    ? ['Wake Up Call', 'You Monster', 'Bridge Over Troubling Water', 'Lunacy', 'Professor Portal', 'Still Alive']
    : appId === 220 ? ['Defiant', 'Trusty Hardware', 'Anchor’s Aweigh!', 'Radiation Levels Detected', 'Follow Freeman', 'Singularity Collapse']
      : ['Head of the Class', 'World Traveler', 'Team Doctor', 'With Friends Like These', 'Hard to Kill', 'Flamethrower'];
  const count = demoGames.find(g => g.appid === appId)?.achievementsUnlocked ?? 3;
  return titles.map((name, i) => ({
    apiName: `demo_${appId}_${i}`, displayName: name,
    description: ['Complete the opening chapter.', 'Make your way through the next challenge.', 'Find a way across.', 'Finish the main adventure.', 'Complete a challenge with a friend.', 'Complete the final challenge.'][i],
    icon: '', iconGray: '', achieved: i < count, unlockTime: i < count ? 1729101600 - i * 86400 : 0,
    globalPercent: [91.2, 64.7, 48.1, 22.8, 8.4, 3.1][i], hidden: false,
  }));
}

export const demoDashboard: Dashboard = {
  totalGames: demoGames.length,
  totalAchievements: 18,
  unlockedAchievements: 12,
  topGamesWithStats: demoGames,
  recentUnlocks: demoGames.flatMap(game => demoAchievements(game.appid).filter(a => a.achieved).slice(0, 2).map(achievement => ({ achievement, game, unlockedAt: achievement.unlockTime }))),
  rarestAchievement: demoAchievements(220)[5],
  rarestAchievementGame: demoGames[1],
};

export const demoRetro: RetroGamesResponse = {
  username: 'SamplePlayer', totalTrackedGames: 2, gamesWithUnlocks: 2,
  games: [
    { gameId: 1, title: 'Super Mario World', imageIconUrl: '', consoleName: 'Super Nintendo', maxPossible: 6, numAwarded: 4, numAwardedHardcore: 2, completionPercentage: 67, hardcoreCompletionPercentage: 33, mostRecentAwardedDate: '2024-10-16' },
    { gameId: 2, title: 'Sonic the Hedgehog', imageIconUrl: '', consoleName: 'Mega Drive', maxPossible: 6, numAwarded: 3, numAwardedHardcore: 1, completionPercentage: 50, hardcoreCompletionPercentage: 17, mostRecentAwardedDate: '2024-10-15' },
  ],
};

export function demoRetroDetail(gameId: number): RetroGameDetail {
  const game = demoRetro.games.find(item => item.gameId === gameId) ?? demoRetro.games[0];
  return {
    username: demoRetro.username, gameId, mediaAppId: -gameId,
    title: game.title, consoleName: game.consoleName, imageIconUrl: '', imageTitleUrl: '', imageBoxArtUrl: '',
    totalAchievements: 6, unlockedAchievements: game.numAwarded, unlockedHardcoreAchievements: game.numAwardedHardcore, completionPercentage: game.completionPercentage,
    achievements: ['First steps', 'A hidden path', 'Quick on your feet', 'Halfway there', 'Last life', 'The final challenge'].map((title, i) => ({
      apiName: `demo_retro_${gameId}_${i}`, title, description: 'Sample achievement for exploring the mobile app.',
      points: (i + 1) * 5, badgeUrl: '', achieved: i < game.numAwarded, unlockTime: i < game.numAwarded ? 1729101600 - i * 86400 : 0,
      hardcoreAchieved: i < game.numAwardedHardcore,
    })),
  };
}
