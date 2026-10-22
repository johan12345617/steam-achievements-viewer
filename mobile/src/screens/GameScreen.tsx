import React from 'react';
import { Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import AchievementList from '../components/AchievementList';
import { Art, DetailHeader, LoadError, Loading, ModeBanner, Notice, Progress, Screen } from '../components/ui';
import { gameImage, hours, percentage, useLoad } from '../lib/data';
import { demoAchievements } from '../lib/demo';
import { GameDetail, RootStackParams } from '../lib/types';

export default function GameScreen({ route, navigation }: NativeStackScreenProps<RootStackParams, 'Game'>) {
  const { game } = route.params;
  const { api, user, mode, apiBase } = useAuth();
  const state = useLoad(`${mode}:${user?.steamId}:${apiBase}:game:${game.appid}`, () => mode === 'demo' ? Promise.resolve({ gameName: game.name ?? 'Sample game', achievements: demoAchievements(game.appid) } as GameDetail) : api.get<GameDetail>(`/steam/achievements/${game.appid}/${user?.steamId}`));
  const achievements = state.data?.achievements ?? [];
  const unlocked = achievements.filter(a => a.achieved).length;
  const title = state.data?.gameName || game.name || `Game ${game.appid}`;
  return <Screen bottom><DetailHeader title={title} goBack={() => navigation.goBack()} /><AchievementList achievements={achievements} refreshing={state.refreshing} onRefresh={() => void state.reload()} loading={state.loading || !!state.error} onPress={achievement => navigation.navigate('Achievement', { achievement, gameName: title, appId: game.appid })}
    header={<><ModeBanner /><Art uri={gameImage(game.appid)} className="aspect-[460/215] w-full" /><Text accessibilityRole="header" className="mt-5 text-2xl font-bold text-white">{title}</Text><Text className="mb-5 mt-2 text-base text-steam-muted">{hours(game.playtime_forever)}</Text>
      {state.loading ? <Loading label="Loading achievements…" /> : null}{state.error ? <LoadError message={state.error} onRetry={() => void state.reload()} /> : null}{state.data?.error ? <Notice>{state.data.error}</Notice> : null}
      {state.data ? <><View className="mb-3 flex-row items-center justify-between"><Text className="text-base text-steam-text">{unlocked} / {achievements.length} unlocked</Text><Text className="text-lg font-semibold text-steam-accent">{percentage(unlocked, achievements.length)}%</Text></View><Progress value={percentage(unlocked, achievements.length)} /></> : null}
    </>} /></Screen>;
}
