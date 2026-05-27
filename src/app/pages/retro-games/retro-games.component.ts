import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { RetroAchievementsService } from '../../services/retroachievements.service';
import { RetroGame, RetroGamesResponse } from '../../models/retroachievements.models';

@Component({
  selector: 'app-retro-games',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  template: `
    <div class="min-h-screen bg-steam-dark">
      <app-navbar />

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-8">
          <h1 class="text-3xl font-black text-steam-text-bright mb-2">Retro Games</h1>
          <p class="text-steam-muted">
            Games from RetroAchievements where you have at least one unlocked achievement.
          </p>
        </div>

        <form (ngSubmit)="connect()" class="card p-5 mb-8">
          <div class="flex flex-col md:flex-row gap-4 md:items-end">
            <div class="flex-1">
              <label class="block text-steam-text text-sm font-medium mb-2">
                RetroAchievements username or ULID
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg class="w-4 h-4 text-steam-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  [(ngModel)]="usernameInput"
                  name="retroUsername"
                  placeholder="e.g. your_ra_username"
                  class="input-steam pl-11"
                  [class.border-red-500]="errorMsg()"
                  [disabled]="loading()"
                />
              </div>
              @if (errorMsg()) {
                <p class="mt-2 text-red-400 text-sm">{{ errorMsg() }}</p>
              }
            </div>

            <div class="flex flex-wrap gap-3">
              <button type="submit" class="btn-primary text-sm" [disabled]="loading()">
                @if (loading()) {
                  <span class="flex items-center gap-2">
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading
                  </span>
                } @else {
                  Connect
                }
              </button>

              <button type="button" class="btn-secondary text-sm" (click)="check()" [disabled]="loading()">
                Check
              </button>

              <button type="button" class="btn-secondary text-sm" (click)="disconnect()" [disabled]="loading() || !connectedUsername()">
                Disconnect
              </button>
            </div>
          </div>
        </form>

        @if (loading() && !retroData()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="card p-5 animate-pulse">
                <div class="w-16 h-16 bg-steam-border/30 rounded-xl mb-4"></div>
                <div class="h-4 bg-steam-border/30 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-steam-border/20 rounded w-1/2 mb-4"></div>
                <div class="h-2 bg-steam-border/20 rounded w-full"></div>
              </div>
            }
          </div>
        } @else if (retroData()) {
          <div class="flex flex-wrap gap-4 mb-6">
            <div class="card px-4 py-3">
              <div class="text-steam-muted text-xs mb-1">{{ isConnectedResult() ? 'Connected' : 'Preview' }}</div>
              <div class="text-steam-text-bright font-bold">{{ retroData()!.username }}</div>
            </div>
            <div class="card px-4 py-3">
              <div class="text-steam-muted text-xs mb-1">Games with unlocks</div>
              <div class="text-steam-text-bright font-bold">{{ retroData()!.gamesWithUnlocks }}</div>
            </div>
            <div class="card px-4 py-3">
              <div class="text-steam-muted text-xs mb-1">Tracked by RA</div>
              <div class="text-steam-text-bright font-bold">{{ retroData()!.totalTrackedGames }}</div>
            </div>
          </div>

          @if (retroData()!.games.length === 0) {
            <div class="text-center py-24">
              <div class="w-16 h-16 rounded-2xl bg-steam-card border border-steam-border flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-steam-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 class="text-steam-text-bright font-bold text-lg mb-2">No RetroAchievements unlocks found</h3>
              <p class="text-steam-muted">Try another username or unlock an achievement on RetroAchievements.</p>
            </div>
          } @else {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
              @for (game of retroData()!.games; track game.gameId) {
                <a
                  [routerLink]="['/retro-games', game.gameId]"
                  [queryParams]="isConnectedResult() ? null : { username: retroData()!.username }"
                  class="card p-5 flex flex-col hover:border-steam-accent/60 hover:shadow-steam hover:-translate-y-1 transition-all duration-200 group"
                >
                  <div class="flex items-start gap-4 mb-4">
                    <div class="w-16 h-16 rounded-xl bg-steam-darker border border-steam-border overflow-hidden flex-shrink-0">
                      @if (game.imageIconUrl) {
                        <img
                          [src]="game.imageIconUrl"
                          [alt]="game.title"
                          class="w-full h-full object-cover"
                          (error)="onImageError($event)"
                        />
                      }
                    </div>
                    <div class="min-w-0">
                      <h3 class="font-bold text-steam-text-bright group-hover:text-steam-accent transition-colors line-clamp-2">
                        {{ game.title }}
                      </h3>
                      <p class="text-steam-muted text-xs mt-1 truncate">{{ game.consoleName }}</p>
                    </div>
                  </div>

                  <div class="mt-auto">
                    <div class="flex items-center justify-between text-sm mb-2">
                      <span class="text-steam-muted">
                        <span class="text-steam-text font-semibold">{{ game.numAwarded }}</span>
                        / {{ game.maxPossible }}
                      </span>
                      <span class="font-bold text-steam-accent">{{ game.completionPercentage }}%</span>
                    </div>
                    <div class="progress-bar mb-3">
                      <div class="progress-fill" [style.width.%]="game.completionPercentage"></div>
                    </div>

                    <div class="flex items-center justify-between text-xs text-steam-muted pt-3 border-t border-steam-border/50">
                      <span>{{ game.numAwardedHardcore }} hardcore</span>
                      <span>{{ formatRecentDate(game) }}</span>
                    </div>
                  </div>
                </a>
              }
            </div>
          }
        } @else {
          <div class="card p-8 text-center">
            <div class="w-14 h-14 rounded-2xl bg-steam-accent/10 border border-steam-accent/20 flex items-center justify-center mx-auto mb-4">
              <svg class="w-7 h-7 text-steam-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M6 8h12a4 4 0 014 4v3a3 3 0 01-5.121 2.121L14.5 14.742h-5l-2.379 2.379A3 3 0 012 15v-3a4 4 0 014-4z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M8 12h2m-1-1v2m7-1h.01M18 14h.01" />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-steam-text-bright mb-2">Connect RetroAchievements</h2>
            <p class="text-steam-muted text-sm">
              Enter your RA username to list games where achievements are already unlocked.
            </p>
          </div>
        }
      </main>
    </div>
  `,
})
export class RetroGamesComponent implements OnInit {
  private readonly retroAchievementsService = inject(RetroAchievementsService);

  usernameInput = '';
  loading = signal(false);
  errorMsg = signal('');
  retroData = signal<RetroGamesResponse | null>(null);
  connectedUsername = this.retroAchievementsService.currentUsername;

  ngOnInit(): void {
    this.loadConnectedGames();
  }

  connect(): void {
    const username = this.getValidatedUsername();
    if (!username) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.retroAchievementsService.connect(username).subscribe({
      next: (res) => {
        this.usernameInput = res.username;
        this.retroData.set(res);
        this.loading.set(false);
      },
      error: (err) => this.handleLoadError(err),
    });
  }

  check(): void {
    const username = this.getValidatedUsername();
    if (!username) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.retroAchievementsService.checkGamesWithUnlocks(username).subscribe({
      next: (res) => {
        this.retroData.set(res);
        this.loading.set(false);
      },
      error: (err) => this.handleLoadError(err),
    });
  }

  disconnect(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.retroAchievementsService.disconnect().subscribe({
      next: () => {
        this.usernameInput = '';
        this.retroData.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.retroAchievementsService.currentUsername.set('');
        this.usernameInput = '';
        this.retroData.set(null);
        this.loading.set(false);
      },
    });
  }

  formatRecentDate(game: RetroGame): string {
    const dateValue = game.mostRecentAwardedDate ?? game.highestAwardDate;
    if (!dateValue) return 'Date unknown';

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Date unknown';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  isConnectedResult(): boolean {
    const connected = this.connectedUsername().toLowerCase();
    const current = this.retroData()?.username.toLowerCase() ?? '';
    return !!connected && connected === current;
  }

  private loadConnectedGames(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.retroAchievementsService.getConnectedGames().subscribe({
      next: (res) => {
        this.usernameInput = res.username;
        this.retroData.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.retroData.set(null);
        if (err?.status && err.status !== 401) {
          this.errorMsg.set(this.toErrorMessage(err?.error?.message));
        }
      },
    });
  }

  private getValidatedUsername(): string | null {
    const username = this.usernameInput.trim();
    this.errorMsg.set('');

    if (!username) {
      this.errorMsg.set('Please enter your RetroAchievements username.');
      return null;
    }

    if (!this.retroAchievementsService.validateUsername(username)) {
      this.errorMsg.set('Use a valid RA username or ULID.');
      return null;
    }

    return username;
  }

  private handleLoadError(err: any): void {
    this.loading.set(false);
    this.retroData.set(null);
    this.errorMsg.set(this.toErrorMessage(err?.error?.message));
  }

  private toErrorMessage(message: unknown): string {
    if (typeof message === 'string' && message.includes('RETROACHIEVEMENTS_API_KEY')) {
      return 'RetroAchievements API key is not configured on the backend.';
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    return 'Could not load RetroAchievements games. Please try again.';
  }
}
