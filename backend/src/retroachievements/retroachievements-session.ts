import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

export const RETROACHIEVEMENTS_SESSION_COOKIE = 'sav_retroachievements_session';
export const RETROACHIEVEMENTS_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface RetroAchievementsSessionUser {
  username: string;
}

interface RetroAchievementsSessionPayload extends RetroAchievementsSessionUser {
  iat: number;
  exp: number;
}

export function createRetroAchievementsSessionCookie(
  user: RetroAchievementsSessionUser,
  secret: string,
): string {
  const now = Date.now();
  const payload: RetroAchievementsSessionPayload = {
    ...user,
    iat: now,
    exp: now + RETROACHIEVEMENTS_SESSION_MAX_AGE_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function readRetroAchievementsSession(
  req: Request,
  secret: string,
): RetroAchievementsSessionUser | null {
  const rawCookie = req.headers.cookie ?? '';
  const cookies = parseCookieHeader(rawCookie);
  const token = cookies[RETROACHIEVEMENTS_SESSION_COOKIE];
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || !isValidSignature(encodedPayload, signature, secret)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as RetroAchievementsSessionPayload;
    if (!payload.username || payload.exp < Date.now()) {
      return null;
    }
    return { username: payload.username };
  } catch {
    return null;
  }
}

export function setRetroAchievementsSessionCookie(
  res: Response,
  token: string,
  isProduction: boolean,
): void {
  res.cookie(RETROACHIEVEMENTS_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: RETROACHIEVEMENTS_SESSION_MAX_AGE_MS,
    path: '/',
  });
}

export function clearRetroAchievementsSessionCookie(
  res: Response,
  isProduction: boolean,
): void {
  res.clearCookie(RETROACHIEVEMENTS_SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
}

function parseCookieHeader(header: string): Record<string, string> {
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) {
      return acc;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
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
