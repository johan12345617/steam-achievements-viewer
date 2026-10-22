import React, { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import BackendSettings from '../components/BackendSettings';
import { Art, Button, ModeBanner, Notice, PageTitle, Screen, SectionTitle } from '../components/ui';
import { errorMessage } from '../lib/data';

export default function AccountScreen() {
  const { user, mode, signOut, signIn, authBusy, authError } = useAuth();
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) { try { setError(null); await action(); } catch (reason) { setError(errorMessage(reason)); } }
  return <Screen><ScrollView keyboardShouldPersistTaps="handled" className="flex-1"><View className="mx-auto w-full max-w-3xl p-5 pb-10">
    <PageTitle title="Account" subtitle="Your profile and connection." /><ModeBanner />
    <View className="mb-5 flex-row items-center gap-4"><Art uri={user?.avatar} icon="person-outline" className="h-16 w-16" /><View className="flex-1"><Text className="text-xl font-semibold text-white">{user?.displayName ?? 'Demo player'}</Text><Text selectable className="mt-1 text-sm text-steam-muted">{mode === 'demo' ? 'Sample account' : user?.steamId}</Text></View></View>
    {error || authError ? <Notice error>{error ?? authError ?? ''}</Notice> : null}
    {mode !== 'signed-in' ? <Button busy={authBusy} onPress={() => void run(signIn)} icon="logo-steam">Sign in with Steam</Button> : <Button secondary icon="open-outline" onPress={() => void run(async () => { await Linking.openURL(`https://steamcommunity.com/profiles/${user?.steamId}`); })}>Open Steam profile</Button>}
    <SectionTitle>Server connection</SectionTitle><BackendSettings />
    <SectionTitle>About your data</SectionTitle>
    <Text className="mb-5 text-base leading-6 text-steam-muted">Steam and RetroAchievements progress comes from their public APIs. Uploaded photos and videos belong to your signed-in Steam account. The mobile app stores its session securely on this device.</Text>
    <Button secondary icon="log-out-outline" busy={authBusy} onPress={() => void run(signOut)}>{mode === 'signed-in' ? 'Sign out' : 'Back to sign in'}</Button>
    <Text className="mt-6 text-center text-xs text-steam-muted">Steam Achievements · mobile preview</Text>
  </View></ScrollView></Screen>;
}
