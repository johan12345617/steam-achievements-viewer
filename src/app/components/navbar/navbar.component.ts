import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SteamService } from '../../services/steam.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bg-steam-card/95 backdrop-blur-md border-b border-steam-border sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">

          <!-- Logo -->
          <div class="flex items-center gap-3">
            <a routerLink="/dashboard" class="flex items-center gap-3 group">
              <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-steam-accent to-steam-teal flex items-center justify-center shadow-steam group-hover:shadow-steam-lg transition-all duration-200">
                <!-- Steam-style controller icon -->
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.979-5.355 11.979-11.979 0-6.623-5.354-11.979-11.979-11.979-.001-.001-.001 0 0 0zm-3.053 14.148c.529 1.035 1.598 1.747 2.84 1.747 1.742 0 3.154-1.412 3.154-3.154 0-1.741-1.412-3.154-3.154-3.154-1.275 0-2.371.748-2.877 1.832l2.84 1.176c.691.286 1.019 1.079.733 1.77-.285.691-1.079 1.02-1.77.733l-1.766-.73v-.22zm7.396-6.35c0 1.744-1.412 3.156-3.154 3.156-1.744 0-3.156-1.412-3.156-3.156 0-1.742 1.412-3.154 3.156-3.154 1.742 0 3.154 1.412 3.154 3.154zm-5.484.002c0 1.291 1.047 2.338 2.338 2.338s2.339-1.047 2.339-2.338-1.048-2.338-2.339-2.338-2.338 1.047-2.338 2.338z"/>
                </svg>
              </div>
              <span class="font-bold text-steam-text-bright text-lg hidden sm:block">
                <span class="text-gradient">Steam</span> Achievements
              </span>
            </a>
          </div>

          <!-- Navigation Links -->
          <div class="flex items-center gap-1">
            <a
              routerLink="/dashboard"
              routerLinkActive="bg-steam-accent/10 text-steam-accent border-steam-accent/30"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-steam-muted hover:text-steam-text hover:bg-white/5 border border-transparent transition-all duration-200 text-sm font-medium"
            >
              <!-- Dashboard icon -->
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span class="hidden sm:block">Dashboard</span>
            </a>

            <a
              routerLink="/games"
              routerLinkActive="bg-steam-accent/10 text-steam-accent border-steam-accent/30"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-steam-muted hover:text-steam-text hover:bg-white/5 border border-transparent transition-all duration-200 text-sm font-medium"
            >
              <!-- Games icon -->
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="hidden sm:block">Games</span>
            </a>
          </div>

          <!-- Player info + logout -->
          <div class="flex items-center gap-3">
            <!-- Player avatar -->
            <div class="flex items-center gap-2.5">
              <div class="relative">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-steam-accent/30 to-steam-teal/30 border border-steam-border flex items-center justify-center">
                  <img
                    [src]="player()!.avatarFullUrl"
                    [alt]="player()!.personaName"
                    class="w-full h-full object-cover rounded-full"
                    (error)="onAvatarError($event)"
                  />
                </div>
              </div>
              <div class="hidden md:block">
                <p class="text-steam-text-bright text-sm font-semibold leading-none">{{ playerName() }}</p>
              </div>
            </div>

            <!-- Logout button -->
            <button
              (click)="logout()"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-steam-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200 text-sm"
              title="Logout"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span class="hidden sm:block">Logout</span>
            </button>
          </div>

        </div>
      </div>
    </nav>
  `,
})
export class NavbarComponent {
  private steamService = inject(SteamService);
  private router = inject(Router);

  playerName = this.steamService.currentPlayerName;
  player = this.steamService.currentPlayerInfo;
  logout(): void {
    this.steamService.currentSteamId.set('');
    this.steamService.currentPlayerName.set('');
    this.steamService.currentPlayerInfo.set({
      steamId: "",
      personaName: "",
      profileUrl: "",
      avatarUrl: "",
      avatarMediumUrl: "",
      avatarFullUrl: "",
      personaState: 0
    });
    this.router.navigate(['/login']);
  }
  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
