import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SteamService } from '../../services/steam.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { OwnedGame } from '../../models/steam.models';
import { environment } from '../../../environments/environment';

type SortOption = 'name' | 'completion' | 'playtime' | 'unlocked';

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  template: `
    <div class="min-h-screen bg-steam-dark">
      <app-navbar />

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <!-- Page header -->
        <div class="mb-8">
          <h1 class="text-3xl font-black text-steam-text-bright mb-2">Your Games</h1>
          <p class="text-steam-muted">
            {{ filteredGames().length }} of {{ games().length }} games
            @if (searchQuery()) {
              matching "<span class="text-steam-text">{{ searchQuery() }}</span>"
            }
          </p>
        </div>

        <!-- Controls -->
        <div class="flex flex-col sm:flex-row gap-4 mb-8">

          <!-- Search -->
          <div class="relative flex-1">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="w-4 h-4 text-steam-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value); resetPage()"
              placeholder="Search games..."
              class="input-steam pl-11"
            />
          </div>

          <!-- Sort -->
          <div class="flex gap-2">
            <select
              [value]="sortBy()"
              (change)="sortBy.set($any($event.target).value); resetPage()"
              class="input-steam w-auto pr-8 cursor-pointer"
            >
              <option value="name">Sort: Name</option>
              <option value="completion">Sort: Completion %</option>
              <option value="playtime">Sort: Playtime</option>
              <option value="unlocked">Sort: Achievements</option>
            </select>

            <!-- Filter: show only completed -->
            <button
              (click)="showOnlyCompleted.set(!showOnlyCompleted()); resetPage()"
              [class]="showOnlyCompleted()
                ? 'px-4 py-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-medium text-sm transition-all duration-200'
                : 'px-4 py-3 rounded-lg bg-steam-card border border-steam-border text-steam-muted hover:text-steam-text font-medium text-sm transition-all duration-200'"
              title="Show only 100% completed games"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Loading state -->
        @if (loading()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="card p-5 animate-pulse">
                <div class="w-full h-32 bg-steam-border/30 rounded-xl mb-4"></div>
                <div class="h-4 bg-steam-border/30 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-steam-border/20 rounded w-1/2 mb-4"></div>
                <div class="h-2 bg-steam-border/20 rounded w-full"></div>
              </div>
            }
          </div>
        } @else if (filteredGames().length === 0) {
          <!-- Empty state -->
          <div class="text-center py-24">
            <div class="w-16 h-16 rounded-2xl bg-steam-card border border-steam-border flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-steam-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 class="text-steam-text-bright font-bold text-lg mb-2">No games found</h3>
            <p class="text-steam-muted">Try adjusting your search or filter.</p>
            <button (click)="clearFilters()" class="btn-secondary mt-4 text-sm">
              Clear filters
            </button>
          </div>
        } @else {
          <!-- Games grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
            @for (game of paginatedGames(); track game.appId) {
              <a
                [routerLink]="['/games', game.appId]"
                class="card p-5 flex flex-col hover:border-steam-accent/60 hover:shadow-steam hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
              >

                <!-- Game banner -->
                <div class="w-full h-28 rounded-xl mb-4 relative overflow-hidden"
                  [class]="getGameGradient(game.appId)"
                >
                  <!-- Steam header image -->
                  <img
                    [src]="getGameImageUrl(game.appId)"
                    [alt]="game.name"
                    [attr.data-appid]="game.appId"
                    class="absolute inset-0 w-full h-full object-cover"
                    (error)="onImageError($event)"
                  />

                  <!-- Dark overlay so text is readable if image loads -->
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>

                  <!-- Playtime bottom-left -->
                  <div class="absolute bottom-2 left-2 text-white/80 text-xs font-medium drop-shadow">
                    {{ formatPlaytime(game.playtimeForever) }} played
                  </div>

                  <!-- Completion badge -->
                  @if ((game.achievementPercentage ?? 0) === 100) {
                    <div class="absolute top-2 right-2 bg-yellow-500/90 text-yellow-950 text-xs font-bold px-2 py-0.5 rounded-full shadow-gold flex items-center gap-1">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      100%
                    </div>
                  }
                </div>

                <!-- Game name -->
                <h3 class="font-bold text-steam-text-bright group-hover:text-steam-accent transition-colors duration-200 mb-1 line-clamp-2 flex-1">
                  {{ game.name }}
                </h3>

                <!-- Achievement count / no achievements -->
                @if ((game.achievementsTotal ?? 0) > 0) {
                  <div class="flex items-center justify-between text-sm mb-3">
                    <span class="text-steam-muted">
                      <span class="text-steam-text font-semibold">{{ game.achievementsUnlocked }}</span>
                      / {{ game.achievementsTotal }}
                    </span>
                    <span
                      class="font-bold text-sm"
                      [class]="getPercentageColor(game.achievementPercentage ?? 0)"
                    >
                      {{ game.achievementPercentage }}%
                    </span>
                  </div>
                  <div class="progress-bar">
                    <div
                      [class]="(game.achievementPercentage ?? 0) === 100 ? 'progress-fill-gold' : 'progress-fill'"
                      [style.width.%]="game.achievementPercentage ?? 0"
                    ></div>
                  </div>
                } @else {
                  <div class="text-steam-muted text-xs mb-3 italic">No achievements</div>
                }

                <!-- Footer -->
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-steam-border/50">
                  <div class="flex items-center gap-1 text-steam-muted text-xs">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {{ formatPlaytime(game.playtimeForever) }}
                  </div>
                  <div class="text-steam-accent text-xs group-hover:text-steam-accent-hover flex items-center gap-1 font-medium transition-colors">
                    View
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

              </a>
            }
          </div>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between mt-8 pt-6 border-t border-steam-border">
              <span class="text-steam-muted text-sm">
                Page {{ currentPage() + 1 }} of {{ totalPages() }}
                &nbsp;·&nbsp; {{ filteredGames().length }} games
              </span>
              <div class="flex gap-2">
                <button
                  (click)="prevPage()"
                  [disabled]="currentPage() === 0"
                  class="px-4 py-2 rounded-lg bg-steam-card border border-steam-border text-sm font-medium
                         disabled:opacity-40 disabled:cursor-not-allowed
                         hover:border-steam-accent hover:text-steam-text-bright transition-all"
                >
                  ← Prev
                </button>
                <button
                  (click)="nextPage()"
                  [disabled]="currentPage() >= totalPages() - 1"
                  class="px-4 py-2 rounded-lg bg-steam-card border border-steam-border text-sm font-medium
                         disabled:opacity-40 disabled:cursor-not-allowed
                         hover:border-steam-accent hover:text-steam-text-bright transition-all"
                >
                  Next →
                </button>
              </div>
            </div>
          }
        }

      </main>
    </div>
  `,
})
export class GamesComponent implements OnInit, OnDestroy {
  private steamService = inject(SteamService);
  private router = inject(Router);
  private http = inject(HttpClient);

  loading = signal(true);
  games = signal<OwnedGame[]>([]);
  searchQuery = signal('');
  sortBy = signal<SortOption>('name');
  showOnlyCompleted = signal(false);
  currentPage = signal(0);

  private readonly PAGE_SIZE = 100;

  filteredGames = computed(() => {
    let list = [...this.games()];
    const query = this.searchQuery().toLowerCase().trim();

    if (query) {
      list = list.filter((g) => g.name.toLowerCase().includes(query));
    }

    if (this.showOnlyCompleted()) {
      list = list.filter((g) => (g.achievementPercentage ?? 0) === 100);
    }

    // Sort
    switch (this.sortBy()) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'completion':
        list.sort((a, b) => (b.achievementPercentage ?? 0) - (a.achievementPercentage ?? 0));
        break;
      case 'playtime':
        list.sort((a, b) => b.playtimeForever - a.playtimeForever);
        break;
      case 'unlocked':
        list.sort((a, b) => (b.achievementsUnlocked ?? 0) - (a.achievementsUnlocked ?? 0));
        break;
    }

    return list;
  });

  totalPages = computed(() => Math.ceil(this.filteredGames().length / this.PAGE_SIZE));

  paginatedGames = computed(() => {
    const page = Math.min(this.currentPage(), Math.max(0, this.totalPages() - 1));
    const start = page * this.PAGE_SIZE;
    return this.filteredGames().slice(start, start + this.PAGE_SIZE);
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

    // Load basic game list first (1 Steam API call) so the page renders immediately,
    // then fetch achievement stats for all games in the background.
    this.steamService.getBasicGames(steamId).subscribe((games) => {
      this.games.set(games);
      this.loading.set(false);

      // Fetch full stats in background; update games signal when ready.
      this.steamService.getOwnedGames(steamId).subscribe((gamesWithStats) => {
        this.games.set(gamesWithStats);
      });
    });
  }

  ngOnDestroy(): void {}

  prevPage(): void {
    this.currentPage.update((p) => Math.max(0, p - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextPage(): void {
    this.currentPage.update((p) => Math.min(this.totalPages() - 1, p + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetPage(): void {
    this.currentPage.set(0);
  }

  getGameGradient(appId: number): string {
    return this.gameGradients[appId] ?? 'bg-gradient-to-br from-steam-accent to-steam-teal';
  }

  getGameImageUrl(appId: number): string {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const appId = img.dataset['appid'];
    const current = img.src;

    if (current.includes('cdn.cloudflare.steamstatic.com')) {
      img.src = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
    } else if (current.includes('cdn.akamai.steamstatic.com')) {
      img.src = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
    } else if (!environment.offlineMode && !img.dataset['backendTried']) {
      // Last resort: ask the backend to resolve the real URL from Steam Store API
      img.dataset['backendTried'] = '1';
      this.http.get<{ url: string; libraryUrl: string }>(`${environment.apiBase}/steam/header/${appId}`).subscribe({
        next: (res) => { img.src = res.url; }, // games list uses landscape header
        error: () => { img.style.display = 'none'; },
      });
    } else {
      img.style.display = 'none';
    }
  }

  getPercentageColor(pct: number): string {
    if (pct === 100) return 'text-yellow-400';
    if (pct >= 75) return 'text-green-400';
    if (pct >= 40) return 'text-steam-accent';
    return 'text-steam-muted';
  }

  formatPlaytime(minutes: number): string {
    return this.steamService.formatPlaytime(minutes);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.showOnlyCompleted.set(false);
    this.currentPage.set(0);
  }
}
