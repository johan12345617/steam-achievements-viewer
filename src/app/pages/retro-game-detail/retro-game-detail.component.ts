import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { UploadModalComponent } from '../../components/upload-modal/upload-modal.component';
import { MediaViewerComponent } from '../../components/media-viewer/media-viewer.component';
import { MediaService } from '../../services/media.service';
import { RetroAchievementsService } from '../../services/retroachievements.service';
import { Achievement, AchievementMedia } from '../../models/steam.models';
import { RetroAchievement, RetroGameDetail } from '../../models/retroachievements.models';

type FilterTab = 'all' | 'unlocked' | 'locked';

@Component({
  selector: 'app-retro-game-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, UploadModalComponent, MediaViewerComponent],
  template: `
    <div class="min-h-screen bg-steam-dark">
      <app-navbar />

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <a
          routerLink="/retro-games"
          class="inline-flex items-center gap-2 text-steam-muted hover:text-steam-text transition-colors duration-200 mb-6 group"
        >
          <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Retro Games
        </a>

        @if (loading()) {
          <div class="flex items-center justify-center py-32">
            <div class="text-center">
              <div class="w-12 h-12 border-2 border-steam-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-steam-muted">Loading retro achievements...</p>
            </div>
          </div>
        } @else if (errorMsg()) {
          <div class="card p-8 text-center">
            <h1 class="text-xl font-bold text-steam-text-bright mb-2">Could not load this retro game</h1>
            <p class="text-steam-muted text-sm mb-5">{{ errorMsg() }}</p>
            <a routerLink="/retro-games" class="btn-secondary text-sm inline-flex">Back to Retro Games</a>
          </div>
        } @else if (gameDetail()) {
          <div class="animate-fade-in">
            <div class="card p-6 lg:p-8 mb-8">
              <div class="flex flex-col sm:flex-row items-start gap-6">
                <div class="w-24 h-24 rounded-2xl flex-shrink-0 shadow-lg overflow-hidden bg-steam-darker border border-steam-border">
                  @if (gameDetail()!.imageIconUrl) {
                    <img
                      [src]="gameDetail()!.imageIconUrl"
                      [alt]="gameDetail()!.title"
                      class="w-full h-full object-cover"
                      (error)="onImageError($event)"
                    />
                  }
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div class="min-w-0">
                      <h1 class="text-2xl font-black text-steam-text-bright mb-1">
                        {{ gameDetail()!.title }}
                      </h1>
                      <p class="text-steam-muted text-sm">
                        {{ gameDetail()!.consoleName }} · RA Game ID: {{ gameDetail()!.gameId }}
                      </p>
                    </div>
                    @if (gameDetail()!.hardcoreCompletionPercentage === 100) {
                      <div class="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl shadow-gold">
                        <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <span class="text-yellow-400 font-bold">Mastered</span>
                      </div>
                    }
                  </div>

                  <div class="flex items-center gap-4 mb-3">
                    <div class="flex-1 progress-bar">
                      <div class="progress-fill" [style.width.%]="gameDetail()!.completionPercentage"></div>
                    </div>
                    <span class="text-sm font-bold text-steam-accent">
                      {{ gameDetail()!.completionPercentage }}%
                    </span>
                  </div>

                  <div class="flex flex-wrap gap-6 text-sm">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                      <span class="text-steam-text-bright font-semibold">{{ gameDetail()!.unlockedAchievements }}</span>
                      <span class="text-steam-muted">unlocked</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-steam-accent/10 border border-steam-accent/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-steam-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <span class="text-steam-text-bright font-semibold">{{ gameDetail()!.totalAchievements }}</span>
                      <span class="text-steam-muted">total</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <span class="text-steam-text-bright font-semibold">{{ gameDetail()!.unlockedHardcoreAchievements }}</span>
                      <span class="text-steam-muted">hardcore</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 mb-6">
              @for (tab of filterTabs; track tab.value) {
                <button
                  (click)="activeFilter.set(tab.value)"
                  [class]="activeFilter() === tab.value
                    ? 'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ' + tab.activeClass
                    : 'px-5 py-2.5 rounded-xl text-sm font-medium text-steam-muted hover:text-steam-text bg-steam-card border border-steam-border hover:border-steam-border/80 transition-all duration-200'"
                >
                  {{ tab.label }}
                  <span class="ml-2 text-xs opacity-75">({{ tab.count() }})</span>
                </button>
              }
            </div>

            <div class="space-y-3">
              @for (achievement of displayedAchievements(); track achievement.apiName) {
                <div
                  (click)="onAchievementCardClick(achievement)"
                  class="card p-5 transition-all duration-200 group"
                  [class]="achievement.achieved
                    ? 'card p-5 transition-all duration-200 group hover:border-yellow-500/30 hover:shadow-gold ' + (getAchievementMedia(achievement.apiName).length > 0 ? 'cursor-pointer' : '')
                    : 'card p-5 transition-all duration-200 group opacity-60'"
                >
                  <div class="flex items-start gap-4">
                    <div
                      class="w-16 h-16 rounded-xl flex-shrink-0 relative transition-transform duration-200 group-hover:scale-105 overflow-hidden"
                      [class]="achievement.achieved
                        ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border border-yellow-500/30'
                        : 'bg-steam-darker border border-steam-border'"
                    >
                      @if (achievement.icon) {
                        <img [src]="achievement.icon" [alt]="achievement.name" class="w-full h-full object-cover" (error)="onImageError($event)" />
                      } @else {
                        <div class="w-full h-full flex items-center justify-center">
                          <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      }
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div class="min-w-0">
                          <h3
                            class="font-bold text-base mb-0.5"
                            [class]="achievement.achieved ? 'text-steam-text-bright' : 'text-steam-muted'"
                          >
                            {{ achievement.name }}
                          </h3>
                          @if (achievement.description) {
                            <p class="text-steam-muted text-sm leading-relaxed">
                              {{ achievement.description }}
                            </p>
                          }
                        </div>

                        @if (achievement.achieved) {
                          <span class="badge-unlocked flex-shrink-0">Unlocked</span>
                        } @else {
                          <span class="badge-locked flex-shrink-0">Locked</span>
                        }
                      </div>

                      <div class="flex flex-wrap items-center justify-between gap-3 mt-3">
                        <div class="flex flex-wrap items-center gap-4 text-xs text-steam-muted">
                          @if (achievement.achieved && achievement.unlockTime) {
                            <div class="flex items-center gap-1.5">
                              <svg class="w-3.5 h-3.5 text-steam-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Unlocked {{ formatDate(achievement.unlockTime) }}</span>
                            </div>
                          }
                          <span>{{ achievement.globalPercentage }} points</span>
                          @if (getAchievementMedia(achievement.apiName).length > 0) {
                            <span class="text-steam-teal">{{ getAchievementMedia(achievement.apiName).length }} media</span>
                          }
                        </div>

                        @if (achievement.achieved && !hasCompleteMediaSet(achievement.apiName)) {
                          <button
                            (click)="openUploadModal(achievement); $event.stopPropagation()"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-steam-accent/10 hover:bg-steam-accent/20 border border-steam-accent/20 hover:border-steam-accent/40 text-steam-accent text-xs font-semibold transition-all duration-200"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {{ getAchievementMedia(achievement.apiName).length > 0 ? 'Add Missing Media' : 'Add Media' }}
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </main>

      @if (selectedAchievement() && gameDetail()) {
        <app-upload-modal
          [achievement]="selectedAchievement()!"
          [appId]="gameDetail()!.mediaAppId"
          (closed)="closeUploadModal()"
          (uploaded)="onMediaUploaded($event)"
        />
      }

      @if (viewerMedia().length > 0) {
        <app-media-viewer
          [media]="viewerMedia()"
          [startIndex]="viewerStartIndex()"
          (close)="closeMediaViewer()"
        />
      }
    </div>
  `,
})
export class RetroGameDetailComponent implements OnInit {
  private readonly retroAchievementsService = inject(RetroAchievementsService);
  private readonly mediaService = inject(MediaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loading = signal(true);
  errorMsg = signal('');
  gameDetail = signal<RetroGameDetail | null>(null);
  activeFilter = signal<FilterTab>('all');
  selectedAchievement = signal<Achievement | null>(null);
  viewerMedia = signal<AchievementMedia[]>([]);
  viewerStartIndex = signal(0);
  private mediaStore = signal<Record<string, AchievementMedia[]>>({});

  filterTabs = [
    {
      value: 'all' as FilterTab,
      label: 'All',
      activeClass: 'bg-steam-accent/10 border border-steam-accent/30 text-steam-accent',
      count: computed(() => this.gameDetail()?.totalAchievements ?? 0),
    },
    {
      value: 'unlocked' as FilterTab,
      label: 'Unlocked',
      activeClass: 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400',
      count: computed(() => this.gameDetail()?.unlockedAchievements ?? 0),
    },
    {
      value: 'locked' as FilterTab,
      label: 'Locked',
      activeClass: 'bg-gray-700/50 border border-gray-600/30 text-gray-300',
      count: computed(() =>
        (this.gameDetail()?.totalAchievements ?? 0) - (this.gameDetail()?.unlockedAchievements ?? 0)
      ),
    },
  ];

  displayedAchievements = computed(() => {
    const detail = this.gameDetail();
    if (!detail) return [];
    const achievements = detail.achievements.map((achievement) => this.mapAchievement(achievement));

    switch (this.activeFilter()) {
      case 'unlocked':
        return achievements.filter((achievement) => achievement.achieved);
      case 'locked':
        return achievements.filter((achievement) => !achievement.achieved);
      default:
        return achievements.sort((a, b) => {
          if (a.achieved && !b.achieved) return -1;
          if (!a.achieved && b.achieved) return 1;
          return (b.unlockTime ?? 0) - (a.unlockTime ?? 0);
        });
    }
  });

  ngOnInit(): void {
    const gameId = Number(this.route.snapshot.paramMap.get('gameId'));
    const previewUsername = this.route.snapshot.queryParamMap.get('username')?.trim();

    if (!Number.isInteger(gameId) || gameId <= 0) {
      this.router.navigate(['/retro-games']);
      return;
    }

    const request$ = previewUsername
      ? this.retroAchievementsService.checkGameProgress(previewUsername, gameId)
      : this.retroAchievementsService.getConnectedGameProgress(gameId);

    request$.subscribe({
      next: (detail) => {
        this.gameDetail.set(detail);
        this.loading.set(false);
        this.loadMedia(detail);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(this.toErrorMessage(err?.error?.message, err?.status));
      },
    });
  }

  formatDate(unixTimestamp: number): string {
    return new Date(unixTimestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getAchievementMedia(apiName: string): AchievementMedia[] {
    return this.mediaStore()[apiName] ?? [];
  }

  hasCompleteMediaSet(apiName: string): boolean {
    const media = this.getAchievementMedia(apiName);
    return media.some((item) => item.type === 'image') && media.some((item) => item.type === 'video');
  }

  onAchievementCardClick(achievement: Achievement): void {
    if (this.getAchievementMedia(achievement.apiName).length === 0) {
      return;
    }
    this.openMediaViewer(achievement.apiName, 0);
  }

  openUploadModal(achievement: Achievement): void {
    this.selectedAchievement.set(achievement);
  }

  closeUploadModal(): void {
    this.selectedAchievement.set(null);
  }

  onMediaUploaded(media: AchievementMedia): void {
    const key = media.achievementApiName;
    const current = this.mediaStore();
    const existing = current[key] ?? [];
    this.mediaStore.set({
      ...current,
      [key]: this.sortMediaForCarousel([...existing, media]),
    });
  }

  openMediaViewer(apiName: string, startIndex: number): void {
    this.viewerMedia.set(this.sortMediaForCarousel(this.getAchievementMedia(apiName)));
    this.viewerStartIndex.set(startIndex);
  }

  closeMediaViewer(): void {
    this.viewerMedia.set([]);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private loadMedia(detail: RetroGameDetail): void {
    this.mediaService.getGameMedia(
      detail.mediaAppId,
      detail.achievements.map((achievement) => achievement.apiName),
    ).subscribe({
      next: (media) => this.mediaStore.set(this.groupMediaByAchievement(media)),
      error: () => this.mediaStore.set({}),
    });
  }

  private mapAchievement(achievement: RetroAchievement): Achievement {
    return {
      apiName: achievement.apiName,
      name: achievement.title,
      description: achievement.description,
      icon: achievement.badgeUrl,
      iconGray: '',
      achieved: achievement.achieved,
      unlockTime: achievement.unlockTime > 0 ? achievement.unlockTime : null,
      globalPercentage: achievement.points,
      hidden: false,
    };
  }

  private groupMediaByAchievement(media: AchievementMedia[]): Record<string, AchievementMedia[]> {
    return media.reduce<Record<string, AchievementMedia[]>>((acc, item) => {
      const list = acc[item.achievementApiName] ?? [];
      acc[item.achievementApiName] = this.sortMediaForCarousel([...list, item]);
      return acc;
    }, {});
  }

  private sortMediaForCarousel(media: AchievementMedia[]): AchievementMedia[] {
    return [...media].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'image' ? -1 : 1;
      }
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    });
  }

  private toErrorMessage(message: unknown, status: number | undefined): string {
    if (status === 401) {
      return 'Connect a RetroAchievements username before opening a saved retro game.';
    }
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    return 'Could not load RetroAchievements progress. Please try again.';
  }
}
