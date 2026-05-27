import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { RetroGameDetail, RetroGamesResponse } from '../models/retroachievements.models';

@Injectable({
  providedIn: 'root',
})
export class RetroAchievementsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  currentUsername = signal<string>('');

  checkGamesWithUnlocks(username: string): Observable<RetroGamesResponse> {
    return this.http.get<RetroGamesResponse>(
      `${this.api}/retroachievements/games/${encodeURIComponent(username)}`,
    );
  }

  connect(username: string): Observable<RetroGamesResponse> {
    return this.http.post<RetroGamesResponse>(
      `${this.api}/retroachievements/connect`,
      { username },
      { withCredentials: true },
    ).pipe(tap((res) => this.currentUsername.set(res.username)));
  }

  getConnectedGames(): Observable<RetroGamesResponse> {
    return this.http.get<RetroGamesResponse>(
      `${this.api}/retroachievements/connected-games`,
      { withCredentials: true },
    ).pipe(tap((res) => this.currentUsername.set(res.username)));
  }

  getConnectedGameProgress(gameId: number): Observable<RetroGameDetail> {
    return this.http.get<RetroGameDetail>(
      `${this.api}/retroachievements/connected-game/${gameId}`,
      { withCredentials: true },
    ).pipe(tap((res) => this.currentUsername.set(res.username)));
  }

  checkGameProgress(username: string, gameId: number): Observable<RetroGameDetail> {
    return this.http.get<RetroGameDetail>(
      `${this.api}/retroachievements/game/${gameId}/${encodeURIComponent(username)}`,
    );
  }

  restoreSession(): Observable<{ username: string }> {
    return this.http.get<{ username: string }>(
      `${this.api}/retroachievements/me`,
      { withCredentials: true },
    ).pipe(tap((res) => this.currentUsername.set(res.username)));
  }

  disconnect(): Observable<void> {
    return this.http.post<{ ok: boolean }>(
      `${this.api}/retroachievements/disconnect`,
      {},
      { withCredentials: true },
    ).pipe(
      tap(() => this.currentUsername.set('')),
      map(() => undefined),
    );
  }

  validateUsername(username: string): boolean {
    const cleanUsername = username.trim();
    return /^[a-zA-Z0-9_-]{2,32}$/.test(cleanUsername) || /^[0-9A-HJKMNP-TV-Z]{26}$/.test(cleanUsername);
  }
}
