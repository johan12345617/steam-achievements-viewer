import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { readCookie, readSteamSession, STEAM_SESSION_MAX_AGE_MS, SteamSessionUser } from './steam-session';

export const MOBILE_REDIRECT_URI = 'steamachievements://auth/callback';
export const MOBILE_TRANSACTION_COOKIE = 'sav_mobile_auth';
export const MOBILE_TRANSACTION_TTL_MS = 10 * 60 * 1000;
export const MOBILE_CODE_TTL_MS = 60 * 1000;
const MAX_PENDING = 1000;
const MAX_SESSIONS = 10000;
const OPAQUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

interface Transaction {
  state: string;
  codeChallenge: string;
  redirectUri: string;
  expiresAt: number;
  browserHash?: string;
}

interface AuthorizationCode extends Transaction {
  user: SteamSessionUser;
}

interface NativeSession {
  user: SteamSessionUser;
  expiresAt: number;
}

/** Single-process storage: restarting the backend invalidates all native sessions. */
@Injectable()
export class MobileAuthService {
  private readonly transactions = new Map<string, Transaction>();
  private readonly codes = new Map<string, AuthorizationCode>();
  private readonly sessions = new Map<string, NativeSession>();

  constructor(private readonly config: ConfigService) {}

  start(body: unknown): { authorizationUrl: string } {
    const input = this.object(body);
    this.validateRedirect(input.redirectUri);
    if (typeof input.codeChallenge !== 'string' || !OPAQUE_PATTERN.test(input.codeChallenge)) {
      throw new BadRequestException('codeChallenge must be an S256 PKCE challenge (base64url SHA-256).');
    }
    if (typeof input.state !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(input.state)) {
      throw new BadRequestException('state must contain 32 to 128 base64url characters.');
    }
    const backendUrl = this.backendUrl;
    this.makeRoom(this.transactions, MAX_PENDING);
    const transaction = randomBytes(32).toString('base64url');
    this.transactions.set(transaction, {
      state: input.state,
      codeChallenge: input.codeChallenge,
      redirectUri: input.redirectUri as string,
      expiresAt: Date.now() + MOBILE_TRANSACTION_TTL_MS,
    });
    return { authorizationUrl: `${backendUrl}/api/auth/mobile/steam?transaction=${transaction}` };
  }

  launch(transactionId: unknown, res: Response): string {
    const transaction = this.transaction(transactionId);
    if (transaction.browserHash) {
      throw new UnauthorizedException('This sign-in link was already opened. Start sign-in again.');
    }
    const browserSecret = randomBytes(32).toString('base64url');
    transaction.browserHash = this.hash(browserSecret);
    res.cookie(MOBILE_TRANSACTION_COOKIE, browserSecret, {
      httpOnly: true,
      secure: this.backendUrl.startsWith('https://'),
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: MOBILE_TRANSACTION_TTL_MS,
    });
    const authorizationUrl = new URL('https://steamcommunity.com/openid/login');
    authorizationUrl.search = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': this.returnUrl(transactionId as string),
      'openid.realm': this.backendUrl,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    }).toString();
    return authorizationUrl.toString();
  }

  assertBrowserTransaction(req: Request): string {
    const transactionId = req.query.mobile;
    const transaction = this.transaction(transactionId);
    const browserSecret = readCookie(req.headers.cookie, MOBILE_TRANSACTION_COOKIE);
    if (!browserSecret || !transaction.browserHash ||
        !this.equal(transaction.browserHash, this.hash(browserSecret))) {
      throw new UnauthorizedException('The sign-in browser does not match. Start sign-in again.');
    }
    // return_to is signed by Steam. An assertion for another transaction must never be accepted.
    if (req.query['openid.mode'] !== 'cancel' &&
        req.query['openid.return_to'] !== this.returnUrl(transactionId as string)) {
      throw new UnauthorizedException('The Steam return URL does not match this sign-in.');
    }
    return transactionId as string;
  }

  complete(transactionId: string, user: SteamSessionUser, res: Response): string {
    const transaction = this.transaction(transactionId);
    if (!user || !/^\d{17}$/.test(user.steamId)) {
      throw new UnauthorizedException('Steam did not return a valid account.');
    }
    this.makeRoom(this.codes, MAX_PENDING);
    const code = randomBytes(32).toString('base64url');
    this.codes.set(this.hash(code), {
      ...transaction,
      user,
      expiresAt: Date.now() + MOBILE_CODE_TTL_MS,
    });
    this.transactions.delete(transactionId);
    this.clearBrowserCookie(res);
    const url = new URL(transaction.redirectUri);
    url.search = new URLSearchParams({ code, state: transaction.state }).toString();
    return url.toString();
  }

  fail(transactionId: string, res: Response, error = 'auth_failed'): string {
    const transaction = this.transaction(transactionId);
    this.transactions.delete(transactionId);
    this.clearBrowserCookie(res);
    const url = new URL(transaction.redirectUri);
    url.search = new URLSearchParams({ error, state: transaction.state }).toString();
    return url.toString();
  }

  exchange(body: unknown): { token: string; user: SteamSessionUser; expiresAt: string } {
    const input = this.object(body);
    this.validateRedirect(input.redirectUri);
    if (typeof input.code !== 'string' || !OPAQUE_PATTERN.test(input.code) ||
        typeof input.codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier)) {
      throw new BadRequestException('A valid authorization code and PKCE verifier are required.');
    }
    this.prune(this.codes);
    const key = this.hash(input.code);
    const code = this.codes.get(key);
    if (!code || code.redirectUri !== input.redirectUri ||
        !this.equal(code.codeChallenge, this.hash(input.codeVerifier))) {
      throw new UnauthorizedException('The authorization code is invalid, expired, or does not match this app.');
    }
    this.makeRoom(this.sessions, MAX_SESSIONS);
    // Consume synchronously before minting a session: two requests cannot redeem the same code.
    this.codes.delete(key);
    const token = `savm_${randomBytes(32).toString('base64url')}`;
    const expiresAt = Date.now() + STEAM_SESSION_MAX_AGE_MS;
    this.sessions.set(this.hash(token), { user: code.user, expiresAt });
    return { token, user: code.user, expiresAt: new Date(expiresAt).toISOString() };
  }

  readSession(req: Request, cookieSecret: string): SteamSessionUser | null {
    // An explicitly supplied invalid bearer token must not fall back to another account's cookie.
    if (req.headers.authorization !== undefined) {
      this.prune(this.sessions);
      const token = this.bearer(req);
      return token ? this.sessions.get(this.hash(token))?.user ?? null : null;
    }
    return readSteamSession(req, cookieSecret);
  }

  logout(req: Request): void {
    const token = this.bearer(req);
    if (token) this.sessions.delete(this.hash(token));
  }

  returnUrl(transactionId: string): string {
    return `${this.backendUrl}/api/auth/steam/callback?mobile=${encodeURIComponent(transactionId)}`;
  }

  get backendUrl(): string {
    const raw = this.config.get<string>('BACKEND_URL') || 'http://localhost:3000';
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/' ||
        (this.config.get('NODE_ENV') === 'production' && url.protocol !== 'https:')) {
      throw new Error('BACKEND_URL must be an HTTP(S) origin, using HTTPS in production.');
    }
    return url.origin;
  }

  private transaction(id: unknown): Transaction {
    this.prune(this.transactions);
    const transaction = typeof id === 'string' && OPAQUE_PATTERN.test(id) ? this.transactions.get(id) : undefined;
    if (!transaction) throw new UnauthorizedException('Sign-in expired or was already completed. Start again.');
    return transaction;
  }

  private clearBrowserCookie(res: Response): void {
    res.clearCookie(MOBILE_TRANSACTION_COOKIE, {
      httpOnly: true, secure: this.backendUrl.startsWith('https://'), sameSite: 'lax', path: '/api/auth',
    });
  }

  private bearer(req: Request): string | null {
    const header = req.headers.authorization;
    return typeof header === 'string' ? /^Bearer (savm_[A-Za-z0-9_-]{43})$/i.exec(header)?.[1] ?? null : null;
  }

  private validateRedirect(value: unknown): void {
    if (value !== MOBILE_REDIRECT_URI) throw new BadRequestException('redirectUri is not allowed.');
  }

  private object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('A JSON object is required.');
    return value as Record<string, unknown>;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
  }

  private equal(a: string, b: string): boolean {
    return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  private prune<T extends { expiresAt: number }>(store: Map<string, T>): void {
    const now = Date.now();
    for (const [key, item] of store) if (item.expiresAt <= now) store.delete(key);
  }

  private makeRoom<T extends { expiresAt: number }>(store: Map<string, T>, limit: number): void {
    this.prune(store);
    if (store.size >= limit) throw new ServiceUnavailableException('Sign-in is busy. Please try again later.');
  }
}
