import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Art, Empty, Icon, LoadError, Loading, ModeBanner, PageTitle, Progress, Screen, SectionTitle } from '../components/ui';
import GameRow from '../components/GameRow';
import { dateLabel, percentage, useLoad } from '../lib/data';
import { demoDashboard } from '../lib/demo';
import { Dashboard, RootStackParams } from '../lib/types';

export default function DashboardScreen() {
  const { api, user, mode, apiBase } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const state = useLoad(`${mode}:${user?.steamId}:${apiBase}:dashboard`, () => mode === 'demo' ? Promise.resolve(demoDashboard) : api.get<Dashboard>(`/steam/dashboard/${user?.steamId}`));
  const { data } = state;
  const rate = data ? percentage(data.unlockedAchievements, data.totalAchievements) : 0;
  return <Screen><FlatList data={data?.recentUnlocks ?? []} keyExtractor={item => `${item.game.appid}:${item.achievement.apiName}`} refreshing={state.refreshing} onRefresh={() => void state.reload()}
    ListHeaderComponent={<View className="mx-auto w-full max-w-3xl px-5 pt-5">
      <PageTitle title="Your progress" subtitle={`Welcome back, ${user?.displayName ?? 'player'}.`} action={<Art uri={user?.avatar} icon="person-outline" className="h-12 w-12" />} /><ModeBanner />
      {state.loading ? <Loading /> : null}{state.error ? <LoadError message={state.error} onRetry={() => void state.reload()} /> : null}
      {data ? <>
        <View className="rounded-2xl bg-steam-navy p-5">
          <View className="flex-row items-center justify-between"><Text className="text-base font-medium text-steam-text">Recent games</Text><Icon name="trophy-outline" size={22} color="#66c0f4" /></View>
          <View className="mb-4 mt-3 flex-row items-baseline gap-2"><Text className="text-5xl font-bold text-white">{data.unlockedAchievements.toLocaleString()}</Text><Text className="flex-1 text-base text-steam-muted">/ {data.totalAchievements.toLocaleString()} unlocked</Text></View>
          <Progress value={rate} /><View className="mt-3 flex-row justify-between"><Text className="text-sm text-steam-text">{rate}% complete</Text><Text className="text-sm text-steam-muted">{data.totalGames} games in library</Text></View>
        </View>
        <Text className="mt-3 text-xs leading-5 text-steam-muted">Progress and recent unlocks cover up to 10 recently played games with achievements.</Text>
        {data.rarestAchievement && data.rarestAchievementGame ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Achievement', { achievement: data.rarestAchievement!, gameName: data.rarestAchievementGame!.name ?? 'Game', appId: data.rarestAchievementGame!.appid })} className="mt-5 flex-row items-center gap-3 rounded-xl border border-steam-border p-4 active:bg-steam-panel">
          <Icon name="diamond-outline" size={27} color="#66c0f4" /><View className="flex-1"><Text className="text-xs font-medium text-steam-accent">RAREST RECENT UNLOCK</Text><Text className="mt-1 text-base font-semibold text-white">{data.rarestAchievement.displayName}</Text><Text className="mt-1 text-sm text-steam-muted">{data.rarestAchievement.globalPercent?.toFixed(1)}% of players · {data.rarestAchievementGame.name}</Text></View><Icon name="chevron-forward" size={18} />
        </Pressable> : null}
        <SectionTitle>Keep going</SectionTitle>
        {data.topGamesWithStats.length ? data.topGamesWithStats.slice(0, 3).map(game => <GameRow key={game.appid} game={game} onPress={() => navigation.navigate('Game', { game })} />) : <Empty title="No recent games to show" description="Your library and game details need to be public for Steam to share progress." />}
        <SectionTitle>Recent unlocks</SectionTitle>
      </> : null}
    </View>}
    renderItem={({ item }) => <View className="mx-auto w-full max-w-3xl px-5"><Pressable accessibilityRole="button" onPress={() => navigation.navigate('Achievement', { achievement: item.achievement, gameName: item.game.name ?? 'Game', appId: item.game.appid })} className="flex-row items-center gap-3 border-b border-steam-border py-4 active:opacity-60">
      <Art uri={item.achievement.icon} icon="trophy-outline" className="h-12 w-12" /><View className="flex-1"><Text className="text-base font-semibold text-white">{item.achievement.displayName}</Text><Text className="mt-1 text-sm text-steam-muted">{item.game.name} · {dateLabel(item.unlockedAt)}</Text></View><Icon name="chevron-forward" size={16} />
    </Pressable></View>}
    ListEmptyComponent={data && !state.loading ? <Empty title="Your next unlock starts here" description="Play a game with achievements and pull down to refresh your progress." /> : null}
    ListFooterComponent={<View className="h-8" />} />
  </Screen>;
}
