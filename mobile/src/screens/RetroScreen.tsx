import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Art, Button, Chips, Empty, Field, Icon, LoadError, Loading, ModeBanner, Notice, PageTitle, Progress, Screen, Search } from '../components/ui';
import { useLoad } from '../lib/data';
import { demoRetro } from '../lib/demo';
import { RetroGamesResponse, RootStackParams } from '../lib/types';

export default function RetroScreen() {
  const { api, mode, apiBase } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [username, setUsername] = useState('');
  const [draft, setDraft] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [consoleFilter, setConsoleFilter] = useState('all');
  useEffect(() => { let active = true; void SecureStore.getItemAsync('retroachievements.username').then(value => { if (active && value) { setUsername(value); setDraft(value); } }).catch(() => {}); return () => { active = false; }; }, []);
  const state = useLoad(`${mode}:${apiBase}:retro:${username}`, () => mode === 'demo' ? Promise.resolve(demoRetro) : api.get<RetroGamesResponse>(`/retroachievements/games/${encodeURIComponent(username)}`), mode === 'demo' || !!username);
  const games = useMemo(() => (state.data?.games ?? []).filter(game => game.title.toLowerCase().includes(query.toLowerCase().trim()) && (consoleFilter === 'all' || game.consoleName === consoleFilter)), [state.data, query, consoleFilter]);
  const consoles = Array.from(new Set(state.data?.games.map(game => game.consoleName) ?? []));
  function lookup() {
    const value = draft.trim();
    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(value)) { setValidation('Use a RetroAchievements username with 2–32 letters, numbers, underscores, or hyphens.'); return; }
    setValidation(null); setEditing(false); setConsoleFilter('all');
    if (value === username) void state.reload(); else setUsername(value);
    void SecureStore.setItemAsync('retroachievements.username', value).catch(() => {});
  }
  return <Screen><FlatList data={games} keyExtractor={game => String(game.gameId)} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshing={state.refreshing} onRefresh={username || mode === 'demo' ? () => void state.reload() : undefined} initialNumToRender={8}
    ListHeaderComponent={<View className="mx-auto w-full max-w-3xl px-5 pt-5"><PageTitle title="Retro achievements" subtitle="Classic games. New milestones." /><ModeBanner />
      {mode !== 'demo' ? <View className="mb-5">
        {!username || editing ? <><Field label="RetroAchievements username" value={draft} onChange={setDraft} placeholder="Your public username" onSubmit={lookup} />{validation ? <Notice error>{validation}</Notice> : null}<Button onPress={lookup} busy={state.loading} disabled={!draft.trim()} icon="search-outline">Look up profile</Button><Text className="mt-3 text-sm leading-5 text-steam-muted">Browse a public profile. This does not sign in to RetroAchievements.</Text></> : <View className="flex-row items-center justify-between gap-3"><View className="flex-1"><Text className="text-lg font-semibold text-white">{state.data?.username ?? username}</Text><Text className="mt-1 text-sm text-steam-muted">Public RetroAchievements profile</Text></View><Button secondary onPress={() => setEditing(true)}>Change</Button></View>}
      </View> : null}
      {state.loading ? <Loading label="Loading retro games…" /> : null}{state.error ? <LoadError message={state.error} onRetry={() => void state.reload()} /> : null}
      {state.data ? <><Text className="mb-4 text-base text-steam-muted">{state.data.gamesWithUnlocks} games with unlocks · {state.data.totalTrackedGames} tracked</Text><Search value={query} onChange={setQuery} placeholder="Search retro games" /><Chips value={consoleFilter} onChange={setConsoleFilter} options={[{ value: 'all', label: 'All consoles' }, ...consoles.map(name => ({ value: name, label: name }))]} /></> : null}
    </View>}
    renderItem={({ item }) => <View className="mx-auto w-full max-w-3xl px-5"><Pressable accessibilityRole="button" onPress={() => navigation.navigate('RetroGame', { game: item, username: state.data?.username ?? username })} className="flex-row items-center gap-3 border-b border-steam-border py-4 active:bg-steam-navy"><Art uri={item.imageIconUrl} className="h-16 w-16" /><View className="flex-1"><Text className="text-base font-semibold text-white">{item.title}</Text><Text className="mb-2 mt-1 text-sm text-steam-muted">{item.consoleName}</Text><Progress value={item.completionPercentage} /><Text className="mt-2 text-xs text-steam-muted">{item.numAwarded} / {item.maxPossible} unlocked · {item.numAwardedHardcore} hardcore</Text></View><Icon name="chevron-forward" size={18} /></Pressable></View>}
    ListEmptyComponent={!state.loading && !state.error ? <Empty title={username || mode === 'demo' ? 'No games found' : 'Bring your classics along'} description={username || mode === 'demo' ? 'Try another search, console, or public profile.' : 'Enter your RetroAchievements username to see games and achievement progress.'} icon="game-controller-outline" /> : null}
    ListFooterComponent={<View className="h-8" />} />
  </Screen>;
}
