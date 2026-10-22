import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

export const STEAM_SESSION_COOKIE = 'sav_steam_session';
export const STEAM_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SteamSessionUser {
  steamId: string;
  displayName: string;
  avatar: string;
}

interface SteamSessionPayload extends SteamSessionUser {
  iat: number;
  exp: number;
}

export function createSteamSessionCookie(user: SteamSessionUser, secret: string): string {
  const now = Date.now();
  const payload: SteamSessionPayload = {
    ...user,
    iat: now,
    exp: now + STEAM_SESSION_MAX_AGE_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function readSteamSession(req: Request, secret: string): SteamSessionUser | null {
  const token = readCookie(req.headers.cookie, STEAM_SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  const [encodedPayload, signature] = parts;
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature) || !isValidSignature(encodedPayload, signature, secret)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SteamSessionPayload;
    if (!payload || typeof payload.steamId !== 'string' || !/^\d{17}$/.test(payload.steamId) ||
        !Number.isFinite(payload.exp) || payload.exp <= Date.now() ||
        !Number.isFinite(payload.iat) || payload.iat > Date.now() || payload.exp <= payload.iat) {
      return null;
    }
    return {
      steamId: payload.steamId,
      displayName: typeof payload.displayName === 'string' ? payload.displayName : '',
      avatar: typeof payload.avatar === 'string' ? payload.avatar : '',
    };
  } catch {
    return null;
  }
}

export function setSteamSessionCookie(res: Response, token: string, isProduction: boolean): void {
  res.cookie(STEAM_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: STEAM_SESSION_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSteamSessionCookie(res: Response, isProduction: boolean): void {
  res.clearCookie(STEAM_SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (typeof header !== 'string' || header.length > 16384) return null;
  let result: string | null = null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === name) {
      if (result !== null) return null;
      try {
        result = decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }
  return result;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function isValidSignature(value: string, signature: string, secret: string): boolean {
  const expected = sign(value, secret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}
