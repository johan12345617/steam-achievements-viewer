import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, throwError, map } from 'rxjs';
import { AchievementMedia, MediaUploadPayload } from '../models/steam.models';
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
    const maxSize = 100 * 1024 * 1024;
    if (payload.file.size > maxSize) {
      return throwError(() => new Error('File too large. Maximum size is 100MB.'));
    }

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/mov'];
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

    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('type', payload.type);
    formData.append('appId', String(payload.appId));
    if (payload.caption) formData.append('caption', payload.caption);
    return this.http.post<AchievementMedia>(
      `${this.api}/media/upload/${payload.achievementApiName}`,
      formData,
    );
  }

  getAchievementMedia(achievementApiName: string, appId: number): Observable<AchievementMedia[]> {
    if (environment.offlineMode) {
      return of(this.mockMediaStore.get(achievementApiName) ?? []).pipe(delay(300));
    }
    return this.http.get<AchievementMedia[]>(
      `${this.api}/media/${achievementApiName}?appId=${appId}`,
    );
  }

  deleteAchievementMedia(mediaId: string, achievementApiName: string): Observable<void> {
    if (environment.offlineMode) {
      const existing = this.mockMediaStore.get(achievementApiName) ?? [];
      this.mockMediaStore.set(achievementApiName, existing.filter((m) => m.id !== mediaId));
      return of(undefined).pipe(delay(400));
    }
    return this.http.delete<void>(`${this.api}/media/${mediaId}`).pipe(map(() => undefined));
  }

  getGameMedia(appId: number): Observable<AchievementMedia[]> {
    if (environment.offlineMode) {
      const allMedia: AchievementMedia[] = [];
      this.mockMediaStore.forEach((list) => allMedia.push(...list.filter((m) => m.appId === appId)));
      return of(allMedia).pipe(delay(400));
    }
    return this.http.get<AchievementMedia[]>(`${this.api}/media/game/${appId}`);
  }
}
