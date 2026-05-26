import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SteamService } from '../../services/steam.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="min-h-screen bg-steam-dark relative overflow-hidden">

      <!-- Animated background -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -left-40 w-96 h-96 bg-steam-accent/5 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-steam-teal/5 rounded-full blur-3xl"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-steam-accent/3 rounded-full blur-3xl"></div>

        <!-- Grid pattern -->
        <div
          class="absolute inset-0 opacity-[0.03]"
          style="background-image: linear-gradient(#4f9eed 1px, transparent 1px), linear-gradient(90deg, #4f9eed 1px, transparent 1px); background-size: 48px 48px;"
        ></div>
      </div>

      <!-- Content -->
      <div class="relative z-10 flex flex-col min-h-screen">

        <!-- Top bar -->
        <div class="flex items-center justify-between px-8 py-6">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-steam-accent to-steam-teal flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.979-5.355 11.979-11.979 0-6.623-5.354-11.979-11.979-11.979-.001-.001-.001 0 0 0zm-3.053 14.148c.529 1.035 1.598 1.747 2.84 1.747 1.742 0 3.154-1.412 3.154-3.154 0-1.741-1.412-3.154-3.154-3.154-1.275 0-2.371.748-2.877 1.832l2.84 1.176c.691.286 1.019 1.079.733 1.77-.285.691-1.079 1.02-1.77.733l-1.766-.73v-.22zm7.396-6.35c0 1.744-1.412 3.156-3.154 3.156-1.744 0-3.156-1.412-3.156-3.156 0-1.742 1.412-3.154 3.156-3.154 1.742 0 3.154 1.412 3.154 3.154zm-5.484.002c0 1.291 1.047 2.338 2.338 2.338s2.339-1.047 2.339-2.338-1.048-2.338-2.339-2.338-2.338 1.047-2.338 2.338z"/>
              </svg>
            </div>
            <span class="text-steam-text-bright font-bold text-lg">
              <span class="text-gradient">Steam</span> Achievements
            </span>
          </div>
          <div class="text-steam-muted text-sm">Viewer v1.0</div>
        </div>

        <!-- Hero section -->
        <div class="flex-1 flex items-center justify-center px-4 py-16">
          <div class="w-full max-w-md">

            <!-- Badge -->
            <div class="flex justify-center mb-8">
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-steam-accent/10 border border-steam-accent/20 rounded-full text-steam-accent text-sm font-medium">
                <div class="w-2 h-2 bg-steam-accent rounded-full animate-pulse"></div>
                Track your gaming achievements
              </div>
            </div>

            <!-- Title -->
            <h1 class="text-4xl sm:text-5xl font-black text-center text-steam-text-bright mb-4 leading-tight">
              Your Steam
              <span class="block text-gradient">Achievement Hub</span>
            </h1>
            <p class="text-steam-muted text-center text-lg mb-10 leading-relaxed">
              View all your unlocked achievements, track your progress across games,
              and showcase your rarest moments.
            </p>

            <!-- Login card -->
            <div class="card p-8">

              <h2 class="text-xl font-bold text-steam-text-bright mb-6">
                Enter your Steam ID
              </h2>

              <form (ngSubmit)="onSubmit()" class="space-y-4">

                <div>
                  <label class="block text-steam-text text-sm font-medium mb-2">
                    Steam ID or Vanity URL
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
                      [(ngModel)]="steamIdInput"
                      name="steamId"
                      placeholder="e.g. 76561198000000001 or myusername"
                      class="input-steam pl-11"
                      [class.border-red-500]="errorMsg()"
                      [class.focus:border-red-500]="errorMsg()"
                      autofocus
                    />
                  </div>
                  @if (errorMsg()) {
                    <p class="mt-2 text-red-400 text-sm flex items-center gap-1.5">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {{ errorMsg() }}
                    </p>
                  }
                </div>

                <button
                  type="submit"
                  class="btn-primary w-full text-base"
                  [disabled]="loading()"
                >
                  @if (loading()) {
                    <span class="flex items-center justify-center gap-2">
                      <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading profile...
                    </span>
                  } @else {
                    <span class="flex items-center justify-center gap-2">
                      View Achievements
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  }
                </button>

              </form>

              <!-- Divider -->
              <div class="flex items-center gap-3 my-6">
                <div class="flex-1 h-px bg-steam-border"></div>
                <span class="text-steam-muted text-xs">OR</span>
                <div class="flex-1 h-px bg-steam-border"></div>
              </div>

              <!-- Steam OpenID -->
              <div class="relative">
                <button
                  class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-steam-darker border border-steam-border rounded-lg text-steam-text text-sm font-medium hover:border-steam-accent/50 hover:text-steam-accent transition-all duration-200"
                  title="Use Steam OpenID for private media ownership"
                  type="button"
                  (click)="loginWithSteam()"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.979-5.355 11.979-11.979 0-6.623-5.354-11.979-11.979-11.979-.001-.001-.001 0 0 0z"/>
                  </svg>
                  Sign in with Steam
                  <span class="ml-auto text-xs bg-steam-accent/10 text-steam-accent px-2 py-0.5 rounded-full">Required for media</span>
                </button>

                @if (showOpenIdInfo()) {
                  <div class="mt-3 p-4 bg-steam-accent/5 border border-steam-accent/20 rounded-lg animate-fade-in">
                    <h4 class="text-steam-accent text-sm font-semibold mb-2 flex items-center gap-2">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      About Steam OpenID
                    </h4>
                    <p class="text-steam-muted text-xs leading-relaxed">
                      Steam OpenID allows one-click authentication using your Steam account.
                    </p>
                  </div>
                }
              </div>

            </div>

            <!-- Info cards -->
            <div class="grid grid-cols-3 gap-3 mt-6">
              <div class="text-center p-4 bg-steam-card/50 border border-steam-border/50 rounded-xl">
                <div class="text-2xl font-black text-steam-accent mb-1">4</div>
                <div class="text-steam-muted text-xs">Sample Games</div>
              </div>
              <div class="text-center p-4 bg-steam-card/50 border border-steam-border/50 rounded-xl">
                <div class="text-2xl font-black text-steam-teal mb-1">22</div>
                <div class="text-steam-muted text-xs">Achievements</div>
              </div>
              <div class="text-center p-4 bg-steam-card/50 border border-steam-border/50 rounded-xl">
                <div class="text-2xl font-black text-yellow-400 mb-1">15</div>
                <div class="text-steam-muted text-xs">Unlocked</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="py-6 border-t border-steam-border/30 flex flex-col items-center gap-2">
          <a
            href="https://github.com/johan12345617"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 text-steam-muted hover:text-steam-accent transition-colors duration-200 text-xs font-medium group"
          >
            <svg class="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
            Built by Johan
          </a>
          <p class="text-steam-muted/50 text-xs text-center">
            Not affiliated with Valve Corporation or Steam.
            Steam and the Steam logo are trademarks of Valve Corporation.
          </p>
        </div>
      </div>

    </div>
  `,
})
export class LoginComponent implements OnInit {
  private steamService = inject(SteamService);
  private router = inject(Router);

  steamIdInput = '';
  loading = signal(false);
  errorMsg = signal('');
  showOpenIdInfo = signal(false);

  ngOnInit(): void {
    this.steamService.restoreSession().subscribe((authenticated) => {
      if (authenticated) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  onSubmit(): void {
    const id = this.steamIdInput.trim();
    this.errorMsg.set('');

    if (!id) {
      this.errorMsg.set('Please enter your Steam ID or vanity URL.');
      return;
    }

    if (!this.steamService.validateSteamId(id)) {
      this.errorMsg.set('Invalid Steam ID format. Use a 17-digit Steam ID or your vanity URL (e.g. "myusername").');
      return;
    }

    this.loading.set(true);

    this.steamService.getPlayerSummary(id).subscribe({
      next: (player) => {
        this.steamService.currentSteamId.set(id);
        this.steamService.currentPlayerName.set(player.personaName);
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('Could not load Steam profile. Please try again.');
      },
    });
  }

  loginWithSteam(): void {
    this.steamService.loginWithSteam();
  }
}
