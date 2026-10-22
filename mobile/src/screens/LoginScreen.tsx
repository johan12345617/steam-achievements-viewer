import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import BackendSettings from '../components/BackendSettings';
import { Button, Field, Icon, Notice, Screen } from '../components/ui';
import { errorMessage } from '../lib/data';

export default function LoginScreen() {
  const { signIn, previewProfile, enterDemo, authBusy, authError } = useAuth();
  const [input, setInput] = useState('');
  const [settings, setSettings] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) { setLocalError(null); try { await action(); } catch (error) { setLocalError(errorMessage(error)); } }
  return <Screen bottom><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1"><ScrollView keyboardShouldPersistTaps="handled" className="flex-1">
    <View className="mx-auto w-full max-w-xl px-6 pb-10 pt-8">
      <View className="mb-8 flex-row items-center gap-3"><Icon name="trophy-outline" size={28} color="#66c0f4" /><Text className="text-lg font-semibold text-white">Steam Achievements</Text></View>
      <Text accessibilityRole="header" className="text-4xl font-bold leading-tight text-white">Every unlock.{"\n"}One place.</Text>
      <Text className="mb-8 mt-4 text-lg leading-7 text-steam-muted">Your Steam library, achievement progress, and the moments worth keeping.</Text>
      {authError || localError ? <Notice error>{localError ?? authError ?? ''}</Notice> : null}
      <Button onPress={() => void run(signIn)} busy={authBusy} icon="logo-steam">Sign in with Steam</Button>
      <Text className="mb-7 mt-3 text-sm leading-5 text-steam-muted">Sign in securely in your browser, then return here. Your Steam password stays with Steam.</Text>
      <View className="mb-6 border-t border-steam-border pt-6">
        <Text accessibilityRole="header" className="mb-3 text-lg font-semibold text-white">Just taking a look?</Text>
        <Field label="Steam ID, profile URL, or vanity name" value={input} onChange={setInput} placeholder="76561198… or your profile name" onSubmit={() => { if (input.trim()) void run(() => previewProfile(input)); }} />
        <Button secondary disabled={!input.trim() || authBusy} onPress={() => void run(() => previewProfile(input))} icon="eye-outline">Preview public profile</Button>
        <Text className="mt-3 text-sm leading-5 text-steam-muted">Preview is read-only. Game details must be public.</Text>
      </View>
      <Button secondary disabled={authBusy} onPress={() => void run(enterDemo)} icon="flask-outline">Explore offline demo</Button>
      <Text className="mb-5 mt-3 text-sm leading-5 text-steam-muted">Sample progress. No account or server required.</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: settings }} onPress={() => setSettings(!settings)} className="min-h-12 flex-row items-center justify-between border-t border-steam-border py-3">
        <View className="flex-row items-center gap-2"><Icon name="settings-outline" size={19} /><Text className="text-base text-steam-text">Server settings</Text></View><Icon name={settings ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>
      {settings ? <View className="pt-3"><BackendSettings /></View> : null}
    </View>
  </ScrollView></KeyboardAvoidingView></Screen>;
}
