import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { createApiClient, normalizeApiBase, type ApiClient } from '../lib/api';
import { storage } from './storage';
import {
  MOBILE_REDIRECT_URI, PENDING_LOGIN_MAX_AGE_MS, assertAuthorizationUrl, isMobileCallback,
  parseAuthCallback, parseSteamInput, toBase64Url, validateSession,
  type MobileSession, type PendingLogin, type SessionUser,
} from './protocol';

type Mode = 'signed-in' | 'preview' | 'demo' | null;
interface SavedSession { mode: Exclude<Mode, null>; user: SessionUser; apiBase: string; token?: string; expiresAt?: string }
interface AuthContextValue {
  ready: boolean;
  user: SessionUser | null;
  mode: Mode;
  apiBase: string;
  api: ApiClient;
  authBusy: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  previewProfile: (input: string) => Promise<void>;
  enterDemo: () => Promise<void>;
  setApiBase: (url: string) => Promise<void>;
}

const CONFIG_KEY = 'sav.mobile.api';
const SESSION_KEY = 'sav.mobile.session';
const PENDING_KEY = 'sav.mobile.pending';
const DEFAULT_API = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiBase || 'https://steam-achievements-viewer.onrender.com/api');
const Context = createContext<AuthContextValue | null>(null);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [apiBase, setBase] = useState(DEFAULT_API);
  const [authBusy, setBusy] = useState(false);
  const [authError, setError] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const base = useRef(DEFAULT_API);
  const busy = useRef(false);
  const generation = useRef(0);
  const completing = useRef<Promise<void> | null>(null);
  const invalidateSession = useCallback((rejectedToken: string) => {
    // A late response from a previous account must never clear a newer login.
    if (token.current !== rejectedToken) return;
    generation.current++;
    token.current = null;
    setUser(null);
    setMode(null);
    setError('Your session has expired. Sign in with Steam again.');
    void storage.remove(SESSION_KEY).catch(() => { /* In-memory credentials are already cleared. */ });
  }, []);
  const api = useMemo(() => createApiClient(apiBase, () => token.current, fetch, invalidateSession), [apiBase, invalidateSession]);

  const commit = useCallback(async (session: SavedSession) => {
    await storage.set(SESSION_KEY, JSON.stringify(session));
    token.current = session.token ?? null;
    setUser(session.user);
    setMode(session.mode);
    setError(null);
  }, []);

  const finishLogin = useCallback((url: string): Promise<void> => {
    if (completing.current) return completing.current;
    const operation = generation.current;
    const task = (async () => {
      const saved = await storage.get(PENDING_KEY);
      if (!saved) return; // Duplicate OS delivery after a completed login is harmless.
      const pending = JSON.parse(saved) as PendingLogin;
      if (pending.apiBase !== base.current) throw new Error('The server changed during sign-in. Please start again.');
      const code = parseAuthCallback(url, pending);
      setBusy(true);
      const result = validateSession(await createApiClient(pending.apiBase).post<MobileSession>('/auth/mobile/exchange', {
        code, codeVerifier: pending.codeVerifier, redirectUri: pending.redirectUri,
      }));
      if (operation !== generation.current) return;
      await commit({ ...result, mode: 'signed-in', apiBase: pending.apiBase });
      await storage.remove(PENDING_KEY);
    })();
    completing.current = task;
    void task.finally(() => {
      completing.current = null;
      busy.current = false;
      setBusy(false);
    }).catch(() => { /* Caller displays the error. */ });
    return task;
  }, [commit]);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const storedBase = await storage.get(CONFIG_KEY);
        const selectedBase = storedBase ? normalizeApiBase(storedBase) : DEFAULT_API;
        base.current = selectedBase;
        if (active) setBase(selectedBase);
        const raw = await storage.get(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw) as SavedSession;
          if (session.apiBase === selectedBase && ['signed-in', 'preview', 'demo'].includes(session.mode)) {
            if (session.mode === 'signed-in') validateSession(session as MobileSession);
            if (!session.user || !/^\d{17}$/.test(session.user.steamId)) throw new Error('The saved profile is invalid. Please sign in again.');
            if (active) {
              token.current = session.token ?? null;
              setUser(session.user);
              setMode(session.mode);
            }
          } else { await storage.remove(SESSION_KEY); }
        }
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && isMobileCallback(initialUrl)) await finishLogin(initialUrl);
        else {
          const pending = await storage.get(PENDING_KEY);
          if (pending && Date.now() - (JSON.parse(pending) as PendingLogin).createdAt > PENDING_LOGIN_MAX_AGE_MS) {
            await storage.remove(PENDING_KEY);
          }
        }
      } catch (error) {
        token.current = null;
        await storage.remove(SESSION_KEY);
        if (active) { setUser(null); setMode(null); setError(errorMessage(error)); }
      } finally { if (active) setReady(true); }
    }
    void restore();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isMobileCallback(url)) void finishLogin(url).catch((error) => setError(errorMessage(error)));
    });
    return () => { active = false; subscription.remove(); };
  }, [finishLogin]);

  // Check revocation after restoration; transient network failures keep the saved session.
  useEffect(() => {
    if (!ready || mode !== 'signed-in') return;
    const check = () => { void api.get<SessionUser>('/auth/me').catch(() => { /* API client handles 401; retain session when offline. */ }); };
    check();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') check(); });
    return () => subscription.remove();
  }, [ready, mode, api]);

  const signIn = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setBusy(true);
    setError(null);
    generation.current++;
    try {
      if (Platform.OS === 'web') throw new Error('Install the Android APK to test Steam sign-in. You can use sample mode in this browser preview.');
      const randomHex = async () => Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const codeVerifier = await randomHex();
      const state = await randomHex();
      const codeChallenge = toBase64Url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
      const pending: PendingLogin = { state, codeVerifier, redirectUri: MOBILE_REDIRECT_URI, apiBase: base.current, createdAt: Date.now() };
      const { authorizationUrl } = await createApiClient(pending.apiBase).post<{ authorizationUrl: string }>('/auth/mobile/start', {
        codeChallenge, state, redirectUri: MOBILE_REDIRECT_URI,
      });
      assertAuthorizationUrl(authorizationUrl, pending.apiBase);
      await storage.set(PENDING_KEY, JSON.stringify(pending));
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, MOBILE_REDIRECT_URI);
      if (result.type === 'success') await finishLogin(result.url);
      else {
        // Android may deliver the link through Linking just before the browser closes.
        if (completing.current) await completing.current;
        else await storage.remove(PENDING_KEY);
      }
    } catch (error) {
      setError(errorMessage(error));
      await storage.remove(PENDING_KEY);
    } finally {
      busy.current = false;
      setBusy(false);
    }
  }, [finishLogin]);

  const signOut = useCallback(async () => {
    generation.current++;
    const currentToken = token.current;
    token.current = null;
    setUser(null);
    setMode(null);
    setError(null);
    await Promise.all([storage.remove(SESSION_KEY), storage.remove(PENDING_KEY)]);
    if (currentToken) {
      try { await createApiClient(base.current, () => currentToken).post('/auth/logout'); }
      catch { setError('Signed out on this device. The server could not be reached to revoke the session.'); }
    }
  }, []);

  const previewProfile = useCallback(async (input: string) => {
    if (busy.current) return;
    busy.current = true;
    setBusy(true);
    setError(null);
    try {
      const parsed = parseSteamInput(input);
      const publicApi = createApiClient(base.current);
      const steamId = parsed.steamId || (await publicApi.get<{ steamId: string }>(`/steam/resolve/${encodeURIComponent(parsed.vanity!)}`)).steamId;
      if (!/^\d{17}$/.test(steamId)) throw new Error('Steam could not find that profile. Check the name and try again.');
      const player = await publicApi.get<{ personaname: string; avatarfull: string }>(`/steam/player/${steamId}`);
      await commit({ mode: 'preview', apiBase: base.current, user: { steamId, displayName: player.personaname || steamId, avatar: player.avatarfull || '' } });
    } catch (error) { setError(errorMessage(error)); }
    finally { busy.current = false; setBusy(false); }
  }, [commit]);

  const enterDemo = useCallback(async () => {
    if (busy.current) return;
    await commit({ mode: 'demo', apiBase: base.current, user: { steamId: '76561198000000001', displayName: 'Sample player', avatar: '' } });
  }, [commit]);

  const setApiBase = useCallback(async (url: string) => {
    if (busy.current) throw new Error('Finish or cancel Steam sign-in before changing the server.');
    const selected = normalizeApiBase(url);
    if (selected === base.current) return;
    await signOut();
    await storage.set(CONFIG_KEY, selected);
    base.current = selected;
    setBase(selected);
    setError(null);
  }, [signOut]);

  return <Context.Provider value={{ ready, user, mode, apiBase, api, authBusy, authError, signIn, signOut, previewProfile, enterDemo, setApiBase }}>{children}</Context.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
