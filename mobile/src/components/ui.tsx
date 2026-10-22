import React, { ComponentProps, ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 22, color = '#c7d5e0' }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Screen({ children, bottom = false }: { children: ReactNode; bottom?: boolean }) {
  return <SafeAreaView edges={bottom ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']} className="flex-1 bg-steam-dark">{children}</SafeAreaView>;
}

export function Button({ children, onPress, icon, busy = false, disabled = false, secondary = false, danger = false }: {
  children: string; onPress: () => void; icon?: IconName; busy?: boolean; disabled?: boolean; secondary?: boolean; danger?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} onPress={onPress} disabled={disabled || busy}
    className={`min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${secondary ? 'border border-steam-border bg-steam-navy' : danger ? 'bg-red-950' : 'bg-steam-accent'} ${disabled || busy ? 'opacity-50' : 'active:opacity-70'}`}>
    {busy ? <ActivityIndicator color={secondary ? '#66c0f4' : '#171a21'} /> : icon ? <Icon name={icon} color={secondary ? '#c7d5e0' : danger ? '#fecaca' : '#171a21'} /> : null}
    <Text className={`text-base font-semibold ${secondary ? 'text-steam-text' : danger ? 'text-red-200' : 'text-steam-dark'}`}>{children}</Text>
  </Pressable>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <View className="mb-5 flex-row items-start justify-between gap-3">
    <View className="flex-1"><Text accessibilityRole="header" className="text-3xl font-bold text-white">{title}</Text>{subtitle ? <Text className="mt-2 text-base leading-6 text-steam-muted">{subtitle}</Text> : null}</View>
    {action}
  </View>;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text accessibilityRole="header" className="mb-3 mt-5 text-xl font-semibold text-white">{children}</Text>;
}

export function DetailHeader({ title, goBack }: { title: string; goBack: () => void }) {
  return <View className="flex-row items-center border-b border-steam-border px-2 py-1">
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} className="min-h-12 min-w-12 items-center justify-center rounded-xl active:bg-steam-panel"><Icon name="arrow-back" /></Pressable>
    <Text numberOfLines={1} className="flex-1 px-2 text-lg font-semibold text-white">{title}</Text>
  </View>;
}

export function ModeBanner() {
  const { mode } = useAuth();
  if (mode === 'signed-in') return null;
  return <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-steam-panel px-3 py-2">
    <Icon name={mode === 'demo' ? 'flask-outline' : 'eye-outline'} size={17} color="#66c0f4" />
    <Text className="flex-1 text-sm text-steam-text">{mode === 'demo' ? 'Offline demo · illustrative progress' : 'Public profile · read-only preview'}</Text>
  </View>;
}

export function Art({ uri, className = 'h-14 w-14', icon = 'game-controller-outline' }: { uri?: string; className?: string; icon?: IconName }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) return <View className={`items-center justify-center overflow-hidden rounded-lg bg-steam-panel ${className}`}><Icon name={icon} size={28} color="#66c0f4" /></View>;
  return <Image source={{ uri }} accessibilityIgnoresInvertColors resizeMode="cover" onError={() => setFailed(true)} className={`rounded-lg bg-steam-panel ${className}`} />;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return <View accessibilityRole="progressbar" accessibilityLabel={label ?? 'Achievement completion'} accessibilityValue={{ min: 0, max: 100, now: clamped }} className="h-1.5 flex-row overflow-hidden rounded-full bg-steam-border">
    {Array.from({ length: 20 }, (_, i) => <View key={i} className={`flex-1 ${i < Math.round(clamped / 5) ? 'bg-steam-accent' : 'bg-steam-border'}`} />)}
  </View>;
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" keyboardShouldPersistTaps="handled">
    <View className="flex-row gap-2">{options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === value }} onPress={() => onChange(option.value)}
      className={`min-h-12 justify-center rounded-full border px-4 ${value === option.value ? 'border-steam-accent bg-steam-panel' : 'border-steam-border bg-steam-navy'}`}>
      <Text className={`text-sm font-medium ${value === option.value ? 'text-steam-accent' : 'text-steam-text'}`}>{option.label}</Text>
    </Pressable>)}</View>
  </ScrollView>;
}

export function Search({ value, onChange, placeholder = 'Search games' }: { value: string; onChange: (text: string) => void; placeholder?: string }) {
  return <View className="mb-3 min-h-12 flex-row items-center rounded-xl border border-steam-border bg-steam-navy px-3">
    <Icon name="search-outline" size={20} color="#9aafbf" />
    <TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor="#9aafbf" value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} returnKeyType="search" className="min-h-12 flex-1 px-3 text-base text-white" />
    {value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} className="min-h-12 min-w-12 items-center justify-center"><Icon name="close-circle" size={20} color="#9aafbf" /></Pressable> : null}
  </View>;
}

export function Field({ label, value, onChange, placeholder, keyboardType = 'default', onSubmit }: {
  label: string; value: string; onChange: (text: string) => void; placeholder?: string;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType']; onSubmit?: () => void;
}) {
  return <View className="mb-3"><Text className="mb-2 text-sm font-medium text-steam-text">{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9aafbf" keyboardType={keyboardType} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={onSubmit}
    className="min-h-12 rounded-xl border border-steam-border bg-steam-navy px-4 py-3 text-base text-white" /></View>;
}

export function Notice({ children, error = false }: { children: string; error?: boolean }) {
  return <View accessibilityRole={error ? 'alert' : undefined} className={`mb-4 rounded-xl p-3 ${error ? 'bg-red-950' : 'bg-steam-panel'}`}><Text className={`text-sm leading-5 ${error ? 'text-red-200' : 'text-steam-text'}`}>{children}</Text></View>;
}

export function Loading({ label = 'Loading your progress…' }: { label?: string }) {
  return <View className="items-center gap-4 px-6 py-14" accessibilityRole="progressbar" accessibilityLabel={label}><ActivityIndicator size="large" color="#66c0f4" /><Text className="text-base text-steam-muted">{label}</Text></View>;
}

export function Empty({ title, description, icon = 'trophy-outline' }: { title: string; description: string; icon?: IconName }) {
  return <View className="items-center gap-3 px-4 py-10"><Icon name={icon} size={36} color="#9aafbf" /><Text className="text-center text-lg font-semibold text-white">{title}</Text><Text className="text-center text-base leading-6 text-steam-muted">{description}</Text></View>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View className="py-4"><Notice error>{message}</Notice><Button secondary icon="refresh" onPress={onRetry}>Try again</Button></View>;
}
