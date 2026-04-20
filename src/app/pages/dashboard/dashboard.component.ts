import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SteamService } from '../../services/steam.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { PlayerSummary, DashboardStats, OwnedGame } from '../../models/steam.models';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  template: `
    <div class="min-h-screen bg-steam-dark">
      <app-navbar />

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        @if (loading()) {
          <div class="flex items-center justify-center py-32">
            <div class="text-center">
              <div class="w-12 h-12 border-2 border-steam-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-steam-muted">Loading your profile...</p>
            </div>
          </div>
        } @else if (player() && stats()) {
          <div class="space-y-8 animate-fade-in">

            <!-- Profile header -->
            <div class="card p-6 lg:p-8">
              <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">

                <!-- Avatar -->
                <div class="relative flex-shrink-0">
                  <div class="w-20 h-20 rounded-2xl border-2 border-steam-accent/30 shadow-steam overflow-hidden bg-gradient-to-br from-steam-accent/20 to-steam-teal/20 flex items-center justify-center">
                    @if (player()!.avatarFullUrl) {
                      <img
                        [src]="player()!.avatarFullUrl"
                        [alt]="player()!.personaName"
                        class="w-full h-full object-cover"
                        (error)="onAvatarError($event)"
                      />
                    } @else {
                      <svg class="w-10 h-10 text-steam-accent/60" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    }
                  </div>
                </div>

                <!-- Player info -->
                <div class="flex-1">
                  <div class="flex flex-wrap items-center gap-3 mb-2">
                    <h1 class="text-2xl font-black text-steam-text-bright">
                      {{ player()!.personaName }}
                    </h1>
                  </div>
                  <p class="text-steam-muted text-sm mb-3">
                    Steam ID: <span class="font-mono text-steam-text">{{ player()!.steamId }}</span>
                  </p>

                  <!-- Quick stats -->
                  <div class="flex flex-wrap gap-4">
                    <div class="flex items-center gap-1.5 text-sm text-steam-muted">
                      <svg class="w-4 h-4 text-steam-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="text-steam-text font-medium">{{ stats()!.totalGames }}</span> games owned
                    </div>
                    <div class="flex items-center gap-1.5 text-sm text-steam-muted">
                      <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      <span class="text-steam-text font-medium">{{ stats()!.unlockedAchievements }}</span> / {{ stats()!.totalAchievements }} achievements
                    </div>
                    <div class="flex items-center gap-1.5 text-sm text-steam-muted">
                      <svg class="w-4 h-4 text-steam-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span class="text-steam-text font-medium">{{ stats()!.unlockRate }}%</span> completion
                    </div>
                  </div>
                </div>

                <!-- Profile actions -->
                <div class="flex gap-3 flex-shrink-0">
                  <a
                    routerLink="/games"
                    class="btn-primary text-sm"
                  >
                    View All Games
                    <svg class="w-4 h-4 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <!-- Stats cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

              <!-- Total Games -->
              <div class="card p-5 group hover:border-steam-accent hover:shadow-steam transition-all duration-200">
                <div class="flex items-start justify-between mb-4">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span class="text-xs text-steam-muted bg-steam-darker px-2 py-1 rounded-lg">Total</span>
                </div>
                <div class="text-3xl font-black text-steam-text-bright mb-1">{{ stats()!.totalGames }}</div>
                <div class="text-steam-muted text-sm">Games Owned</div>
              </div>

              <!-- Total Achievements -->
              <div class="card p-5 group hover:border-yellow-500/50 hover:shadow-gold transition-all duration-200">
                <div class="flex items-start justify-between mb-4">
                  <div class="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <span class="text-xs text-steam-muted bg-steam-darker px-2 py-1 rounded-lg">Unlocked</span>
                </div>
                <div class="text-3xl font-black text-steam-text-bright mb-1">
                  {{ stats()!.unlockedAchievements }}
                  <span class="text-lg text-steam-muted font-normal">/ {{ stats()!.totalAchievements }}</span>
                </div>
                <div class="text-steam-muted text-sm">Achievements</div>
                <div class="text-steam-muted/50 text-xs mt-0.5">Recent games</div>
              </div>

              <!-- Unlock Rate -->
              <div class="card p-5 group hover:border-steam-teal/50 transition-all duration-200">
                <div class="flex items-start justify-between mb-4">
                  <div class="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg class="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span class="text-xs text-steam-muted bg-steam-darker px-2 py-1 rounded-lg">Rate</span>
                </div>
                <div class="text-3xl font-black text-steam-text-bright mb-1">
                  {{ stats()!.unlockRate }}<span class="text-lg text-steam-muted font-normal">%</span>
                </div>
                <div class="text-steam-muted text-sm">Unlock Rate</div>
                <div class="text-steam-muted/50 text-xs mt-0.5">Recent games</div>
                <!-- Mini progress bar -->
                <div class="progress-bar mt-3">
                  <div class="progress-fill" [style.width.%]="stats()!.unlockRate"></div>
                </div>
              </div>

              <!-- Rarest Achievement -->
              <div class="card p-5 group hover:border-purple-500/50 transition-all duration-200">
                <div class="flex items-start justify-between mb-4">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <span class="text-xs text-purple-400/80 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg">Rarest</span>
                </div>
                @if (stats()!.rarestAchievement) {
                  <div class="text-sm font-bold text-steam-text-bright mb-0.5 truncate">
                    {{ stats()!.rarestAchievement!.name }}
                  </div>
                  @if (stats()!.rarestAchievementGame) {
                    <a
                      [routerLink]="['/games', stats()!.rarestAchievementGame!.appId]"
                      class="text-steam-accent text-xs truncate mb-1 block hover:text-steam-accent-hover hover:underline transition-colors"
                    >
                      {{ stats()!.rarestAchievementGame!.name }}
                    </a>
                  }
                  <div class="text-steam-muted text-xs">
                    Only <span class="text-purple-400 font-semibold">{{ stats()!.rarestAchievement!.globalPercentage }}%</span> of players
                  </div>
                } @else {
                  <div class="text-steam-muted text-sm">No rare achievements yet</div>
                }
              </div>

            </div>

            <!-- Recent Unlocks -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <!-- Recent unlocks list -->
              <div class="lg:col-span-2">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-bold text-steam-text-bright">Recent Unlocks</h2>
                  <a routerLink="/games" class="text-steam-accent text-sm hover:text-steam-accent-hover transition-colors">
                    View all games →
                  </a>
                </div>

                <div class="space-y-3">
                  @for (unlock of stats()!.recentUnlocks; track unlock.achievement.apiName) {
                    <div class="card p-4 hover:border-steam-accent/40 transition-all duration-200 group">
                      <div class="flex items-center gap-4">

                    <!-- Achievement icon -->
                        <div
                          class="w-16 h-16 rounded-xl flex-shrink-0 relative transition-transform duration-200 group-hover:scale-105 overflow-hidden"
                          [class]="unlock.achievement.achieved
                            ? 'bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border border-yellow-500/30'
                            : 'bg-steam-darker border border-steam-border'"
                        >
                          @if (unlock.achievement.achieved && unlock.achievement.icon) {
                            <img [src]="unlock.achievement.icon" [alt]="unlock.achievement.name"
                              class="w-full h-full object-cover"
                              (error)="onIconError($event)" />
                          } @else if (unlock.achievement.achieved) {
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
                          <p class="text-steam-text-bright font-semibold text-sm truncate">
                            {{ unlock.achievement.name }}
                          </p>
                          <p class="text-steam-muted text-xs truncate mt-0.5">
                            {{ unlock.achievement.description }}
                          </p>
                          <div class="flex items-center gap-3 mt-1.5">
                            <a
                              [routerLink]="['/games', unlock.game.appId]"
                              class="text-steam-accent text-xs font-medium hover:text-steam-accent-hover hover:underline transition-colors"
                              (click)="$event.stopPropagation()"
                            >
                              {{ unlock.game.name }}
                            </a>
                            @if (unlock.achievement.globalPercentage) {
                              <span class="text-steam-muted text-xs">
                                {{ unlock.achievement.globalPercentage }}% global
                              </span>
                            }
                          </div>
                        </div>

                        <!-- Date -->
                        <div class="text-right flex-shrink-0">
                          <span class="badge-unlocked">Unlocked</span>
                          <p class="text-steam-muted text-xs mt-1.5">
                            {{ formatDate(unlock.unlockedAt) }}
                          </p>
                        </div>

                      </div>
                    </div>
                  }

                  @if (stats()!.recentUnlocks.length === 0) {
                    <div class="card p-8 text-center">
                      <div class="w-12 h-12 rounded-full bg-steam-border/50 flex items-center justify-center mx-auto mb-3">
                        <svg class="w-6 h-6 text-steam-muted" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                      <p class="text-steam-muted">No achievements unlocked yet.</p>
                      <a routerLink="/games" class="text-steam-accent text-sm mt-2 block hover:text-steam-accent-hover">
                        Browse your games →
                      </a>
                    </div>
                  }
                </div>
              </div>

              <!-- Game overview sidebar -->
              <div>
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-bold text-steam-text-bright">Latest games with achivements</h2>
                  <a routerLink="/games" class="text-steam-accent text-sm hover:text-steam-accent-hover transition-colors">
                    All →
                  </a>
                </div>
                <div class="space-y-3">
                  @for (game of topGames(); track game.appId) {
                    <a
                      [routerLink]="['/games', game.appId]"
                      class="card p-3 flex items-center gap-3 hover:border-steam-accent/40 hover:shadow-steam transition-all duration-200 group block"
                    >
                      <!-- Game image -->
                      <div class="w-14 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-steam-border/30 group-hover:scale-105 transition-transform">
                        <img
                          [src]="getGameImageUrl(game.appId)"
                          [alt]="game.name"
                          [attr.data-appid]="game.appId"
                          class="w-full h-full object-cover"
                          (error)="onSidebarImageError($event)"
                        />
                      </div>

                      <!-- Game info -->
                      <div class="flex-1 min-w-0">
                        <p class="text-steam-text font-medium text-sm truncate group-hover:text-steam-text-bright transition-colors">
                          {{ game.name }}
                        </p>
                        @if ((game.achievementsTotal ?? 0) > 0) {
                          <div class="progress-bar mt-1.5">
                            <div
                              [class]="(game.achievementPercentage ?? 0) === 100 ? 'progress-fill-gold' : 'progress-fill'"
                              [style.width.%]="game.achievementPercentage ?? 0"
                            ></div>
                          </div>
                          <p class="text-steam-muted text-xs mt-1">
                            {{ game.achievementsUnlocked }}/{{ game.achievementsTotal }} ({{ game.achievementPercentage }}%)
                          </p>
                        } @else {
                          <p class="text-steam-muted text-xs mt-1.5 italic">No achievements</p>
                        }
                      </div>
                    </a>
                  }
                </div>
              </div>

            </div>

          </div>
        }

      </main>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private steamService = inject(SteamService);
  private router = inject(Router);
  private http = inject(HttpClient);

  loading = signal(true);
  player = signal<PlayerSummary | null>(null);
  stats = signal<DashboardStats | null>(null);
  topGames = signal<OwnedGame[]>([]);

  ngOnInit(): void {
    const steamId = this.steamService.currentSteamId();
    if (!steamId) {
      this.router.navigate(['/login']);
      return;
    }

    this.steamService.getPlayerSummary(steamId).subscribe((p) => this.player.set(p));

    // Single fast call: fetches basic game list + achievements for top 10 recent games only
    this.steamService.getDashboardData(steamId).subscribe(({ stats, topGames }) => {
      this.stats.set(stats);
      this.topGames.set(topGames);
      this.loading.set(false);
    });
  }

  getGameImageUrl(appId: number): string {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  onSidebarImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const appId = img.dataset['appid'];
    const current = img.src;
    if (current.includes('cdn.cloudflare.steamstatic.com')) {
      img.src = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
    } else if (!environment.offlineMode && !img.dataset['backendTried']) {
      img.dataset['backendTried'] = '1';
      this.http.get<{ url: string }>(`${environment.apiBase}/steam/header/${appId}`).subscribe({
        next: (res) => { img.src = res.url; },
        error: () => { img.style.display = 'none'; },
      });
    } else {
      img.style.display = 'none';
    }
  }

  formatDate(date: Date): string {
    if (!date || date.getTime() < 1000) return 'Date unknown';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return String(date.getFullYear());
  }
  onIconError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
