import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SteamService } from '../../services/steam.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { UploadModalComponent } from '../../components/upload-modal/upload-modal.component';
import { MediaViewerComponent } from '../../components/media-viewer/media-viewer.component';
import { GameStats, Achievement, AchievementMedia } from '../../models/steam.models';
import { environment } from '../../../environments/environment';

type FilterTab = 'all' | 'unlocked' | 'locked';

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, UploadModalComponent, MediaViewerComponent],
  template: `
    <div class="min-h-screen bg-steam-dark">
      <app-navbar />

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <!-- Back button -->
        <a
          routerLink="/games"
          class="inline-flex items-center gap-2 text-steam-muted hover:text-steam-text transition-colors duration-200 mb-6 group"
        >
          <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Games
        </a>

        @if (loading()) {
          <div class="flex items-center justify-center py-32">
            <div class="text-center">
              <div class="w-12 h-12 border-2 border-steam-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-steam-muted">Loading achievements...</p>
            </div>
          </div>
        } @else if (gameStats()) {
          <div class="animate-fade-in">

            <!-- Game header -->
            <div class="card p-6 lg:p-8 mb-8">
              <div class="flex flex-col sm:flex-row items-start gap-6">

                <!-- Game icon -->
                <div
                  class="w-20 h-20 rounded-2xl flex-shrink-0 shadow-lg overflow-hidden relative"
                  [class]="gameGradient()"
                >
                  <img
                    [src]="getGameImageUrl(appId())"
                    [alt]="gameStats()!.name"
                    [attr.data-appid]="appId()"
                    class="w-full h-full object-cover object-center"
                    (error)="onGameImageError($event)"
                  />
                </div>

                <!-- Game info -->
                <div class="flex-1">
                  <div class="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div>
                      <h1 class="text-2xl font-black text-steam-text-bright mb-1">
                        {{ gameStats()!.name }}
                      </h1>
                      <p class="text-steam-muted text-sm">
                        App ID: {{ gameStats()!.appId }} ·
                        {{ formatPlaytime(gameStats()!.playtimeForever) }} played
                      </p>
                    </div>

                    <!-- Completion badge -->
                    @if (gameStats()!.percentage === 100) {
                      <div class="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl shadow-gold">
                        <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <span class="text-yellow-400 font-bold">100% Complete!</span>
                      </div>
                    }
                  </div>

                  <!-- Progress -->
                  <div class="flex items-center gap-4 mb-3">
                    <div class="flex-1 progress-bar">
                      <div
                        [class]="gameStats()!.percentage === 100 ? 'progress-fill-gold' : 'progress-fill'"
                        [style.width.%]="gameStats()!.percentage"
                      ></div>
                    </div>
                    <span
                      class="text-sm font-bold flex-shrink-0"
                      [class]="getPercentageColor(gameStats()!.percentage)"
                    >
                      {{ gameStats()!.percentage }}%
                    </span>
                  </div>

                  <div class="flex flex-wrap gap-6 text-sm">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                      <span class="text-steam-text-bright font-semibold">{{ gameStats()!.unlockedAchievements }}</span>
                      <span class="text-steam-muted">unlocked</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-gray-500/10 border border-gray-600/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <span class="text-steam-text-bright font-semibold">{{ gameStats()!.totalAchievements - gameStats()!.unlockedAchievements }}</span>
                      <span class="text-steam-muted">locked</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-steam-accent/10 border border-steam-accent/20 flex items-center justify-center">
                        <svg class="w-4 h-4 text-steam-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <span class="text-steam-text-bright font-semibold">{{ gameStats()!.totalAchievements }}</span>
                      <span class="text-steam-muted">total</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Filter tabs -->
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

            <!-- Achievements list -->
            <div class="space-y-3">
              @for (achievement of displayedAchievements(); track achievement.apiName) {
                <!-- Hidden + locked + not yet revealed → spoiler card -->
                @if (achievement.hidden && !achievement.achieved && !isRevealed(achievement.apiName)) {
                  <div class="card p-5 transition-all duration-200 opacity-70 border-dashed">
                    <div class="flex items-center gap-4">

                      <!-- Blurred icon -->
                      <div class="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden bg-steam-darker border border-steam-border relative">
                        @if (achievement.iconGray) {
                          <img [src]="achievement.iconGray" [alt]="achievement.name"
                            class="w-full h-full object-cover blur-md scale-110" />
                        }
                        <div class="absolute inset-0 flex items-center justify-center">
                          <svg class="w-6 h-6 text-steam-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        </div>
                      </div>

                      <div class="flex-1 min-w-0">
                        <p class="text-steam-muted/60 text-sm italic mb-2">Hidden achievement — may contain spoilers</p>
                        <button
                          (click)="revealAchievement(achievement.apiName)"
                          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-steam-card border border-steam-border hover:border-steam-accent/40 hover:text-steam-accent text-steam-muted text-xs font-semibold transition-all duration-200"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Reveal
                        </button>
                      </div>

                      <span class="badge-locked flex-shrink-0">
                        <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Locked
                      </span>
                    </div>
                  </div>

                } @else {
                <!-- Normal card (unlocked, non-hidden locked, or revealed) -->
                <div
                  class="card p-5 transition-all duration-200 group"
                  [class]="achievement.achieved
                    ? 'card p-5 transition-all duration-200 group hover:border-yellow-500/30 hover:shadow-gold'
                    : 'card p-5 transition-all duration-200 group opacity-60'"
                >
                  <div class="flex items-start gap-4">

                    <!-- Achievement icon -->
                    <div
                      class="w-16 h-16 rounded-xl flex-shrink-0 relative transition-transform duration-200 group-hover:scale-105 overflow-hidden"
                      [class]="achievement.achieved
                        ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border border-yellow-500/30'
                        : 'bg-steam-darker border border-steam-border'"
                    >
                      @if (achievement.achieved && achievement.icon) {
                        <img [src]="achievement.icon" [alt]="achievement.name"
                          class="w-full h-full object-cover"
                          (error)="onIconError($event)" />
                      } @else if (!achievement.achieved && achievement.iconGray) {
                        <img [src]="achievement.iconGray" [alt]="achievement.name"
                          class="w-full h-full object-cover"
                          (error)="onIconError($event)" />
                      } @else if (achievement.achieved) {
                        <div class="w-full h-full flex items-center justify-center">
                          <svg class="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        </div>
                      } @else {
                        <div class="w-full h-full flex items-center justify-center">
                          <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      }
                    </div>

                    <!-- Achievement details -->
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
                          } @else {
                            <p class="text-steam-muted/50 text-sm italic">No description provided.</p>
                          }
                        </div>

                        <!-- Status badge -->
                        @if (achievement.achieved) {
                          <span class="badge-unlocked flex-shrink-0">
                            <svg class="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            Unlocked
                          </span>
                        } @else {
                          <span class="badge-locked flex-shrink-0">
                            <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Locked
                          </span>
                        }
                      </div>

                      <!-- Footer row -->
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

                          @if (achievement.globalPercentage !== undefined) {
                            <div class="flex items-center gap-1.5">
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span
                                [class]="getRarityColor(achievement.globalPercentage)"
                                class="font-medium"
                              >
                                {{ achievement.globalPercentage }}% global
                              </span>
                              <span class="text-steam-muted font-normal">
                                ({{ getRarityLabel(achievement.globalPercentage) }})
                              </span>
                            </div>
                          }

                          @if (getAchievementMedia(achievement.apiName).length > 0) {
                            <div class="flex items-center gap-1 text-steam-teal">
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {{ getAchievementMedia(achievement.apiName).length }} media
                            </div>
                          }
                        </div>

                        <!-- Add Media button -->
                        @if (achievement.achieved) {
                          <button
                            (click)="openUploadModal(achievement)"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-steam-accent/10 hover:bg-steam-accent/20 border border-steam-accent/20 hover:border-steam-accent/40 text-steam-accent text-xs font-semibold transition-all duration-200"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Media
                          </button>
                        }
                      </div>

                      <!-- Media thumbnails preview — click to open viewer -->
                      @if (getAchievementMedia(achievement.apiName).length > 0) {
                        <div class="flex gap-2 mt-3">
                          @for (media of getAchievementMedia(achievement.apiName); track media.id; let i = $index) {
                            <button
                              (click)="openMediaViewer(achievement.apiName, i)"
                              class="w-16 h-10 rounded-lg overflow-hidden border border-steam-border hover:border-steam-accent/60 flex-shrink-0 transition-all duration-200 hover:scale-105 hover:shadow-[0_0_8px_rgba(79,158,237,0.4)] relative group"
                              title="{{ media.type === 'video' ? 'Play video' : 'View image' }}"
                            >
                              @if (media.type === 'image') {
                                <img
                                  [src]="media.thumbnailUrl ?? media.url"
                                  [alt]="media.caption || 'Media'"
                                  class="w-full h-full object-cover"
                                />
                              } @else {
                                <div class="w-full h-full bg-steam-darker flex items-center justify-center">
                                  <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              }
                              <!-- Hover overlay -->
                              <div class="absolute inset-0 bg-steam-accent/0 group-hover:bg-steam-accent/10 transition-colors duration-200 flex items-center justify-center">
                                <svg class="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </button>
                          }
                        </div>
                      }

                    </div>
                  </div>
                </div>
                } <!-- end @else -->
              } <!-- end @for -->

              @if (displayedAchievements().length === 0) {
                <div class="text-center py-16">
                  <div class="w-14 h-14 rounded-2xl bg-steam-card border border-steam-border flex items-center justify-center mx-auto mb-4">
                    <svg class="w-7 h-7 text-steam-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <h3 class="text-steam-text font-semibold mb-2">No achievements here</h3>
                  <p class="text-steam-muted text-sm">Try switching the filter tab above.</p>
                </div>
              }

            </div>

          </div>
        }

      </main>

      <!-- Upload Modal -->
      @if (selectedAchievement()) {
        <app-upload-modal
          [achievement]="selectedAchievement()!"
          [appId]="appId()"
          (closed)="closeUploadModal()"
          (uploaded)="onMediaUploaded($event)"
        />
      }

      <!-- Media Viewer -->
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
export class GameDetailComponent implements OnInit {
  private steamService = inject(SteamService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  loading = signal(true);
  gameStats = signal<GameStats | null>(null);
  activeFilter = signal<FilterTab>('all');
  selectedAchievement = signal<Achievement | null>(null);
  appId = signal<number>(0);

  // Media store keyed by achievement API name
  private mediaStore = signal<Record<string, AchievementMedia[]>>({});

  // Media viewer state
  viewerMedia = signal<AchievementMedia[]>([]);
  viewerStartIndex = signal(0);

  // Tracks which hidden achievements the user has chosen to reveal
  private revealedSet = signal<Set<string>>(new Set());

  filterTabs = [
    {
      value: 'all' as FilterTab,
      label: 'All',
      activeClass: 'bg-steam-accent/10 border border-steam-accent/30 text-steam-accent',
      count: computed(() => this.gameStats()?.totalAchievements ?? 0),
    },
    {
      value: 'unlocked' as FilterTab,
      label: 'Unlocked',
      activeClass: 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400',
      count: computed(() => this.gameStats()?.unlockedAchievements ?? 0),
    },
    {
      value: 'locked' as FilterTab,
      label: 'Locked',
      activeClass: 'bg-gray-700/50 border border-gray-600/30 text-gray-300',
      count: computed(() =>
        (this.gameStats()?.totalAchievements ?? 0) - (this.gameStats()?.unlockedAchievements ?? 0)
      ),
    },
  ];

  displayedAchievements = computed(() => {
    const stats = this.gameStats();
    if (!stats) return [];
    const filter = this.activeFilter();
    switch (filter) {
      case 'unlocked':
        return stats.achievements.filter((a) => a.achieved);
      case 'locked':
        return stats.achievements.filter((a) => !a.achieved);
      default:
        // Show unlocked first
        return [...stats.achievements].sort((a, b) => {
          if (a.achieved && !b.achieved) return -1;
          if (!a.achieved && b.achieved) return 1;
          return (b.unlockTime ?? 0) - (a.unlockTime ?? 0);
        });
    }
  });

  private gameGradients: Record<number, string> = {
    220: 'bg-gradient-to-br from-orange-600 to-red-700',
    620: 'bg-gradient-to-br from-blue-500 to-indigo-700',
    730: 'bg-gradient-to-br from-yellow-500 to-orange-600',
    440: 'bg-gradient-to-br from-red-600 to-rose-800',
  };

  ngOnInit(): void {
    const steamId = this.steamService.currentSteamId();
    if (!steamId) {
      this.router.navigate(['/login']);
      return;
    }

    const appIdParam = Number(this.route.snapshot.paramMap.get('appId'));
    this.appId.set(appIdParam);

    this.steamService.getGameStats(appIdParam, steamId).subscribe({
      next: (stats) => {
        this.gameStats.set(stats);
        this.loading.set(false);

        // Pre-load existing media for unlocked achievements
        const unlockedNames = stats.achievements.filter((a) => a.achieved).map((a) => a.apiName);
        unlockedNames.forEach((name) => {
          // Mock: initial media is already in media service store
        });
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/games']);
      },
    });
  }

  gameGradient(): string {
    return this.gameGradients[this.appId()] ?? 'bg-gradient-to-br from-steam-accent to-steam-teal';
  }

  getPercentageColor(pct: number): string {
    if (pct === 100) return 'text-yellow-400';
    if (pct >= 75) return 'text-green-400';
    if (pct >= 40) return 'text-steam-accent';
    return 'text-steam-muted';
  }

  getRarityLabel(pct: number): string {
    if (pct < 5) return 'Ultra Rare';
    if (pct < 15) return 'Rare';
    if (pct < 30) return 'Uncommon';
    return 'Common';
  }

  getRarityColor(pct: number): string {
    if (pct < 5) return 'text-purple-400';
    if (pct < 15) return 'text-blue-400';
    if (pct < 30) return 'text-teal-400';
    return 'text-steam-muted';
  }

  formatDate(unixTimestamp: number): string {
    return this.steamService.formatUnlockDate(unixTimestamp);
  }

  formatPlaytime(minutes: number): string {
    return this.steamService.formatPlaytime(minutes);
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
      [key]: [...existing, media],
    });
  }

  getAchievementMedia(apiName: string): AchievementMedia[] {
    return this.mediaStore()[apiName] ?? [];
  }

  isRevealed(apiName: string): boolean {
    return this.revealedSet().has(apiName);
  }

  revealAchievement(apiName: string): void {
    const next = new Set(this.revealedSet());
    next.add(apiName);
    this.revealedSet.set(next);
  }

  onIconError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  getGameImageUrl(appId: number): string {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
  }

  onGameImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const appId = img.dataset['appid'];
    const current = img.src;
    if (current.includes('cdn.cloudflare')) {
      img.src = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
    } else if (!environment.offlineMode && !img.dataset['backendTried']) {
      img.dataset['backendTried'] = '1';
      this.http.get<{ url: string; libraryUrl: string }>(`${environment.apiBase}/steam/header/${appId}`).subscribe({
        next: (res) => { img.src = res.libraryUrl || res.url; },
        error: () => { img.style.display = 'none'; },
      });
    } else {
      img.style.display = 'none';
    }
  }

  openMediaViewer(apiName: string, startIndex: number): void {
    this.viewerMedia.set(this.getAchievementMedia(apiName));
    this.viewerStartIndex.set(startIndex);
  }

  closeMediaViewer(): void {
    this.viewerMedia.set([]);
  }
}
