import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Game } from '../lib/types';
import { gameImage, hours } from '../lib/data';
import { Art, Icon, Progress } from './ui';

export default function GameRow({ game, onPress }: { game: Game; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${game.name ?? `Game ${game.appid}`}`} onPress={onPress} className="min-h-24 flex-row items-center gap-3 border-b border-steam-border py-4 active:opacity-60">
    <Art uri={gameImage(game.appid)} className="h-16 w-24" />
    <View className="flex-1"><Text numberOfLines={2} className="text-base font-semibold text-white">{game.name ?? `Game ${game.appid}`}</Text><Text className="mb-2 mt-1 text-sm text-steam-muted">{hours(game.playtime_forever)}</Text>
      {game.achievementsTotal !== undefined && game.achievementsTotal > 0 ? <><Progress value={game.achievementPercentage ?? 0} /><Text className="mt-1 text-xs text-steam-muted">{game.achievementsUnlocked ?? 0} / {game.achievementsTotal} unlocked</Text></> : null}
    </View><Icon name="chevron-forward" size={18} color="#9aafbf" />
  </Pressable>;
}
