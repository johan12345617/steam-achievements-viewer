import React from 'react';
import { Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import AchievementList from '../components/AchievementList';
import { Art, DetailHeader, LoadError, Loading, ModeBanner, Progress, Screen } from '../components/ui';
import { useLoad } from '../lib/data';
import { demoRetroDetail } from '../lib/demo';
import { Achievement, RetroGameDetail, RootStackParams } from '../lib/types';

export default function RetroGameScreen({ route, navigation }: NativeStackScreenProps<RootStackParams, 'RetroGame'>) {
  const { game, username } = route.params;
  const { api, mode, apiBase } = useAuth();
  const state = useLoad(`${mode}:${apiBase}:retro-game:${username}:${game.gameId}`, () => mode === 'demo' ? Promise.resolve(demoRetroDetail(game.gameId)) : api.get<RetroGameDetail>(`/retroachievements/game/${game.gameId}/${encodeURIComponent(username)}`));
  const achievements: Achievement[] = state.data?.achievements.map(a => ({ apiName: a.apiName, displayName: a.title, description: a.description, icon: a.badgeUrl, iconGray: a.badgeUrl, achieved: a.achieved, unlockTime: a.unlockTime, globalPercent: null, hidden: false, points: a.points, hardcore: a.hardcoreAchieved })) ?? [];
  return <Screen bottom><DetailHeader title={game.title} goBack={() => navigation.goBack()} /><AchievementList achievements={achievements} refreshing={state.refreshing} onRefresh={() => void state.reload()} loading={state.loading || !!state.error}
    onPress={achievement => { if (state.data) navigation.navigate('Achievement', { achievement, gameName: game.title, appId: state.data.mediaAppId }); }}
    header={<><ModeBanner /><View className="flex-row items-center gap-4"><Art uri={state.data?.imageIconUrl || game.imageIconUrl} className="h-20 w-20" /><View className="flex-1"><Text accessibilityRole="header" className="text-2xl font-bold text-white">{game.title}</Text><Text className="mt-2 text-base text-steam-muted">{game.consoleName} · {username}</Text></View></View>
      {state.loading ? <Loading /> : null}{state.error ? <LoadError message={state.error} onRetry={() => void state.reload()} /> : null}
      {state.data ? <View className="mt-6"><View className="mb-3 flex-row justify-between"><Text className="text-base text-steam-text">{state.data.unlockedAchievements} / {state.data.totalAchievements} unlocked</Text><Text className="text-lg font-semibold text-steam-accent">{Math.round(state.data.completionPercentage)}%</Text></View><Progress value={state.data.completionPercentage} /><Text className="mt-3 text-sm text-steam-muted">{state.data.unlockedHardcoreAchievements} unlocked in hardcore mode</Text></View> : null}
    </>} /></Screen>;
}
