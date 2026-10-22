import React, { ReactNode, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Achievement } from '../lib/types';
import { dateLabel } from '../lib/data';
import { Art, Chips, Empty, Icon, Search } from './ui';

export default function AchievementList({ achievements, header, onPress, refreshing, onRefresh, loading = false }: {
  achievements: Achievement[]; header: ReactNode; onPress: (achievement: Achievement) => void; refreshing: boolean; onRefresh: () => void; loading?: boolean;
}) {
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('status');
  const visibleName = (a: Achievement) => a.hidden && !a.achieved ? 'Hidden achievement' : a.displayName;
  const items = useMemo(() => achievements.filter(a => `${visibleName(a)} ${a.hidden && !a.achieved ? '' : a.description}`.toLowerCase().includes(search.trim().toLowerCase()))
    .filter(a => filter === 'all' || (filter === 'unlocked' ? a.achieved : !a.achieved))
    .sort((a, b) => sort === 'name' ? visibleName(a).localeCompare(visibleName(b)) : sort === 'recent' ? b.unlockTime - a.unlockTime : sort === 'rarity' ? (a.globalPercent ?? 101) - (b.globalPercent ?? 101) : Number(b.achieved) - Number(a.achieved)), [achievements, search, filter, sort]);
  const hasRarity = achievements.some(a => a.globalPercent !== null);
  return <FlatList data={items} keyExtractor={item => item.apiName} refreshing={refreshing} onRefresh={onRefresh} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<View className="mx-auto w-full max-w-3xl px-5 pt-5">
      {header}
      {!loading && achievements.length > 0 ? <View className="mt-6"><Search value={query} onChange={setQuery} placeholder="Search achievements" />
        <Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${achievements.length})` }, { value: 'unlocked', label: `Unlocked (${achievements.filter(a => a.achieved).length})` }, { value: 'locked', label: 'Locked' }]} />
        <Chips value={sort} onChange={setSort} options={[{ value: 'status', label: 'Status' }, { value: 'recent', label: 'Latest unlock' }, ...(hasRarity ? [{ value: 'rarity', label: 'Rarest first' }] : []), { value: 'name', label: 'Name' }]} />
        <Text className="mb-2 text-sm text-steam-muted">{items.length} {items.length === 1 ? 'achievement' : 'achievements'}</Text>
      </View> : null}
    </View>}
    renderItem={({ item }) => <View className="mx-auto w-full max-w-3xl px-5"><Pressable accessibilityRole="button" accessibilityLabel={`${visibleName(item)}, ${item.achieved ? 'unlocked' : 'locked'}. Open details.`} onPress={() => onPress(item)} className="flex-row items-start gap-3 border-b border-steam-border py-4 active:bg-steam-navy">
      <Art uri={item.hidden && !item.achieved ? undefined : item.achieved ? item.icon : item.iconGray} icon={item.achieved ? 'trophy-outline' : 'lock-closed-outline'} className="h-14 w-14" />
      <View className="flex-1"><Text className={`text-base font-semibold ${item.achieved ? 'text-white' : 'text-steam-text'}`}>{visibleName(item)}</Text><Text numberOfLines={2} className="mt-1 text-sm leading-5 text-steam-muted">{item.hidden && !item.achieved ? 'Hidden achievement. Open to reveal details.' : item.description || 'No description available.'}</Text>
        <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1"><Text className={`text-xs font-medium ${item.achieved ? 'text-steam-accent' : 'text-steam-muted'}`}>{item.achieved ? `Unlocked · ${dateLabel(item.unlockTime)}` : 'Locked'}</Text>{item.globalPercent !== null ? <Text className="text-xs text-steam-muted">{item.globalPercent.toFixed(1)}% of players</Text> : null}{item.points !== undefined ? <Text className="text-xs text-steam-muted">{item.points} points{item.hardcore ? ' · Hardcore' : ''}</Text> : null}</View>
      </View><Icon name="chevron-forward" size={16} color="#9aafbf" />
    </Pressable></View>}
    ListEmptyComponent={!loading ? <Empty title={achievements.length ? 'No matching achievements' : 'No achievements available'} description={achievements.length ? 'Try a different filter or search.' : 'This game may have no achievements, or your game details may be private.'} /> : null}
    ListFooterComponent={<View className="h-8" />} />;
}
