export const MOBILE_REDIRECT_URI = 'steamachievements://auth/callback';
export const PENDING_LOGIN_MAX_AGE_MS = 10 * 60 * 1000;

export interface SessionUser {
  steamId: string;
  displayName: string;
  avatar: string;
}

export interface PendingLogin {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  apiBase: string;
  createdAt: number;
}

export interface MobileSession {
  token: string;
  user: SessionUser;
  expiresAt: string;
}

export function toBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseAuthCallback(url: string, pending: PendingLogin, now = Date.now()): string {
  const parsed = new URL(url);
  const expected = new URL(MOBILE_REDIRECT_URI);
  if (parsed.protocol !== expected.protocol || parsed.host !== expected.host || parsed.pathname !== expected.pathname ||
      parsed.username || parsed.password || parsed.hash) {
    throw new Error('Unexpected sign-in link. Start Steam sign-in again from the app.');
  }
  if (now - pending.createdAt > PENDING_LOGIN_MAX_AGE_MS || pending.createdAt > now ||
      pending.redirectUri !== MOBILE_REDIRECT_URI) {
    throw new Error('This sign-in attempt expired. Please start again.');
  }
  if (parsed.searchParams.getAll('state').length !== 1 || parsed.searchParams.get('state') !== pending.state) {
    throw new Error('This sign-in link does not match your request. Please start again.');
  }
  if (parsed.searchParams.has('error')) {
    throw new Error('Steam sign-in was cancelled or could not be verified. Please try again.');
  }
  const code = parsed.searchParams.get('code');
  if (parsed.searchParams.getAll('code').length !== 1 || !code || !/^[A-Za-z0-9_-]{32,256}$/.test(code)) {
    throw new Error('The sign-in link is incomplete. Please start again.');
  }
  return code;
}

export function isMobileCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'steamachievements:' && parsed.host === 'auth' && parsed.pathname === '/callback';
  } catch { return false; }
}

export function assertAuthorizationUrl(url: string, apiBase: string): void {
  const target = new URL(url);
  const base = new URL(apiBase);
  if (target.origin !== base.origin || target.username || target.password || target.hash ||
      !target.pathname.startsWith(`${base.pathname}/auth/`)) {
    throw new Error('The server returned an unexpected Steam login address.');
  }
}

export function parseSteamInput(input: string): { steamId?: string; vanity?: string } {
  const value = input.trim();
  if (/^\d{17}$/.test(value)) return { steamId: value };
  if (/^[a-zA-Z0-9_-]{2,64}$/.test(value)) return { vanity: value };
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (!['steamcommunity.com', 'www.steamcommunity.com'].includes(url.hostname) || url.username || url.password) throw new Error();
    const match = url.pathname.match(/^\/(id|profiles)\/([^/]+)\/?$/);
    if (match?.[1] === 'profiles' && /^\d{17}$/.test(match[2])) return { steamId: match[2] };
    if (match?.[1] === 'id' && /^[a-zA-Z0-9_-]{2,64}$/.test(match[2])) return { vanity: match[2] };
  } catch { /* Show the same useful validation for any unsupported input. */ }
  throw new Error('Enter a 17-digit Steam ID, a vanity name, or a steamcommunity.com profile URL.');
}

export function validateSession(value: MobileSession): MobileSession {
  if (!value || typeof value.token !== 'string' || value.token.length < 32 ||
      !value.user || !/^\d{17}$/.test(value.user.steamId) ||
      typeof value.user.displayName !== 'string' || typeof value.user.avatar !== 'string' ||
      !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) {
    throw new Error('The server returned an invalid session. Please sign in again.');
  }
  return value;
}
