import React, { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Button, Chips, Empty, LoadError, Loading, ModeBanner, PageTitle, Screen, Search } from '../components/ui';
import GameRow from '../components/GameRow';
import { useLoad } from '../lib/data';
import { demoGames } from '../lib/demo';
import { Game, RootStackParams } from '../lib/types';

export default function LibraryScreen() {
  const { api, user, mode, apiBase } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [loadCounts, setLoadCounts] = useState(false);
  const key = `${mode}:${user?.steamId}:${apiBase}`;
  const state = useLoad(`${key}:games`, () => mode === 'demo' ? Promise.resolve(demoGames) : api.get<Game[]>(`/steam/games/${user?.steamId}`));
  const counts = useLoad(`${key}:counts`, () => mode === 'demo' ? Promise.resolve(demoGames) : api.get<Game[]>(`/steam/games-with-stats/${user?.steamId}`), loadCounts);
  const allGames = counts.data ?? state.data ?? [];
  const games = useMemo(() => allGames.filter(game => (game.name ?? '').toLowerCase().includes(deferredQuery.trim().toLowerCase()))
    .filter(game => filter === 'all' || (filter === 'played' && game.playtime_forever > 0) || (filter === 'unplayed' && game.playtime_forever === 0) || (filter === 'complete' && game.achievementPercentage === 100))
    .sort((a, b) => sort === 'name' ? (a.name ?? '').localeCompare(b.name ?? '') : sort === 'hours' ? b.playtime_forever - a.playtime_forever : (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0)), [allGames, deferredQuery, filter, sort]);
  return <Screen><FlatList data={games} keyExtractor={game => String(game.appid)} refreshing={state.refreshing || counts.refreshing} onRefresh={() => { void state.reload(); if (loadCounts) void counts.reload(); }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
    ListHeaderComponent={<View className="mx-auto w-full max-w-3xl px-5 pt-5">
      <PageTitle title="Steam library" subtitle={`${allGames.length.toLocaleString()} games. Find your next challenge.`} /><ModeBanner />
      <Search value={query} onChange={setQuery} />
      <Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All games' }, { value: 'played', label: 'Played' }, { value: 'unplayed', label: 'Unplayed' }, ...(counts.data || mode === 'demo' ? [{ value: 'complete', label: 'Completed' }] : [])]} />
      <Text className="mb-2 text-xs font-medium text-steam-muted">SORT BY</Text>
      <Chips value={sort} onChange={setSort} options={[{ value: 'recent', label: 'Recently played' }, { value: 'name', label: 'Name' }, { value: 'hours', label: 'Playtime' }]} />
      {state.loading ? <Loading label="Loading your library…" /> : null}
      {state.error ? <LoadError message={state.error} onRetry={() => void state.reload()} /> : null}
      {!!state.data?.length && !loadCounts && mode !== 'demo' ? <View className="mb-3"><Button secondary icon="stats-chart-outline" onPress={() => setLoadCounts(true)}>Load achievement counts</Button><Text className="mt-2 text-xs leading-5 text-steam-muted">Optional. Large libraries can take longer to load.</Text></View> : null}
      {counts.loading && loadCounts ? <Loading label="Loading achievement counts…" /> : null}
      {counts.error ? <LoadError message={counts.error} onRetry={() => void counts.reload()} /> : null}
    </View>}
    renderItem={({ item }) => <View className="mx-auto w-full max-w-3xl px-5"><GameRow game={item} onPress={() => navigation.navigate('Game', { game: item })} /></View>}
    ListEmptyComponent={!state.loading && !state.error ? <Empty title={query || filter !== 'all' ? 'No matching games' : 'No games available'} description={query || filter !== 'all' ? 'Try another search or change the filter.' : 'Your Steam profile and game details must be public. Pull down to try again.'} icon="game-controller-outline" /> : null}
    ListFooterComponent={<View className="h-8" />} />
  </Screen>;
}
