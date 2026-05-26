import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, throwError, map, switchMap, catchError } from 'rxjs';
import { AchievementMedia, MediaUploadPayload, MediaUploadTicket } from '../models/steam.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private http = inject(HttpClient);
  private api = environment.apiBase;

  // In-memory mock storage (keyed by achievementApiName)
  private mockMediaStore: Map<string, AchievementMedia[]> = new Map([
    [
      'HL2_BEAT_GAME',
      [
        {
          id: 'mock-media-001',
          achievementApiName: 'HL2_BEAT_GAME',
          appId: 220,
          type: 'image',
          url: 'https://placehold.co/800x450/1a1f2e/4f9eed?text=My+Escape+Screenshot',
          thumbnailUrl: 'https://placehold.co/320x180/1a1f2e/4f9eed?text=Thumbnail',
          caption: 'Finally escaped City 17!',
          uploadedAt: new Date(Date.now() - 86400000 * 25),
        },
      ],
    ],
    [
      'TF2_SPY_BACKSTAB',
      [
        {
          id: 'mock-media-002',
          achievementApiName: 'TF2_SPY_BACKSTAB',
          appId: 440,
          type: 'image',
          url: 'https://placehold.co/800x450/1a1f2e/4db8b8?text=Backstab+Spree',
          thumbnailUrl: 'https://placehold.co/320x180/1a1f2e/4db8b8?text=Thumbnail',
          caption: 'Sneaky beaky like',
          uploadedAt: new Date(Date.now() - 86400000 * 40),
        },
      ],
    ],
  ]);

  uploadAchievementMedia(payload: MediaUploadPayload): Observable<AchievementMedia> {
    const maxSize = payload.type === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (payload.file.size > maxSize) {
      return throwError(() => new Error(`File too large. Maximum size is ${payload.type === 'image' ? '10MB' : '100MB'}.`));
    }

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const allowedTypes = payload.type === 'image' ? allowedImageTypes : allowedVideoTypes;
    if (!allowedTypes.includes(payload.file.type)) {
      return throwError(() => new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`));
    }

    if (environment.offlineMode) {
      const objectUrl = URL.createObjectURL(payload.file);
      const newMedia: AchievementMedia = {
        id: `mock-${Date.now()}`,
        achievementApiName: payload.achievementApiName,
        appId: payload.appId,
        type: payload.type,
        url: objectUrl,
        thumbnailUrl: payload.type === 'image' ? objectUrl : undefined,
        caption: payload.caption,
        uploadedAt: new Date(),
      };
      const existing = this.mockMediaStore.get(payload.achievementApiName) ?? [];
      this.mockMediaStore.set(payload.achievementApiName, [...existing, newMedia]);
      return of(newMedia).pipe(delay(1200));
    }

    return this.http.post<MediaUploadTicket>(
      `${this.api}/media/upload-url/${payload.achievementApiName}`,
      {
        appId: payload.appId,
        type: payload.type,
        fileName: payload.file.name,
        contentType: payload.file.type,
        sizeBytes: payload.file.size,
      },
      { withCredentials: true },
    ).pipe(
      switchMap((ticket) =>
        this.http.put(ticket.uploadUrl, payload.file, {
          headers: ticket.headers,
          responseType: 'text',
        }).pipe(map(() => ticket.media.id)),
      ),
      switchMap((mediaId) =>
        this.http.post<AchievementMedia>(
          `${this.api}/media/complete/${mediaId}`,
          {},
          { withCredentials: true },
        ),
      ),
      catchError((err) => throwError(() => new Error(this.errorMessage(err)))),
    );
  }

  getAchievementMedia(achievementApiName: string, appId: number): Observable<AchievementMedia[]> {
    if (environment.offlineMode) {
      return of(this.mockMediaStore.get(achievementApiName) ?? []).pipe(delay(300));
    }
    return this.http.get<AchievementMedia[]>(
      `${this.api}/media/${achievementApiName}?appId=${appId}`,
      { withCredentials: true },
    );
  }

  deleteAchievementMedia(mediaId: string, achievementApiName: string): Observable<void> {
    if (environment.offlineMode) {
      const existing = this.mockMediaStore.get(achievementApiName) ?? [];
      this.mockMediaStore.set(achievementApiName, existing.filter((m) => m.id !== mediaId));
      return of(undefined).pipe(delay(400));
    }
    return this.http.delete<void>(`${this.api}/media/${mediaId}`, { withCredentials: true }).pipe(map(() => undefined));
  }

  getGameMedia(appId: number, achievementApiNames: string[] = []): Observable<AchievementMedia[]> {
    if (environment.offlineMode) {
      const allMedia: AchievementMedia[] = [];
      this.mockMediaStore.forEach((list) => allMedia.push(...list.filter((m) => m.appId === appId)));
      return of(allMedia).pipe(delay(400));
    }
    if (achievementApiNames.length > 0) {
      return this.http.post<AchievementMedia[]>(
        `${this.api}/media/game/${appId}/resolve`,
        { achievementApiNames },
        { withCredentials: true },
      );
    }
    return this.http.get<AchievementMedia[]>(`${this.api}/media/game/${appId}`, { withCredentials: true });
  }

  private errorMessage(err: any): string {
    const message = err?.error?.message ?? err?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
    return 'Upload failed. Please try again.';
  }
}
