import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/data';
import { Button, Field, Notice } from './ui';

export default function BackendSettings() {
  const { apiBase, setApiBase, api } = useAuth();
  const [draft, setDraft] = useState(apiBase);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setDraft(apiBase); setMessage(null); }, [apiBase]);
  async function save() {
    setBusy(true); setMessage(null);
    try { await setApiBase(draft); setFailed(false); setMessage('Server address saved. You can now test the connection.'); }
    catch (error) { setFailed(true); setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMessage(null);
    try {
      const config = await api.get<{ enabled: boolean; codeChallengeMethod: string }>('/auth/mobile/config');
      if (!config.enabled || config.codeChallengeMethod !== 'S256') throw new Error('This server needs the mobile login update.');
      setFailed(false); setMessage('Connected. The server is ready for mobile sign-in.');
    }
    catch (error) { setFailed(true); setMessage(`Cannot connect. ${errorMessage(error)}`); }
    finally { setBusy(false); }
  }
  return <View className="gap-3">
    <Field label="Server address" value={draft} onChange={setDraft} placeholder="https://your-server.example/api" keyboardType="url" />
    <Text className="mb-1 text-sm leading-5 text-steam-muted">Use your server’s HTTPS address, including /api. Local HTTP testing requires a build with LAN access enabled. A phone cannot reach your computer through localhost.</Text>
    {message ? <Notice error={failed}>{message}</Notice> : null}
    <Button onPress={() => void save()} disabled={draft.trim() === apiBase} busy={busy} icon="save-outline">Save address</Button>
    <Button onPress={() => void test()} busy={busy} secondary icon="pulse-outline">Test connection</Button>
  </View>;
}
