import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SteamService } from './services/steam.service';
import { map } from 'rxjs';

// Auth guard: redirect to /login if no Steam ID in session
export function authGuard() {
  const steamService = inject(SteamService);
  const router = inject(Router);
  if (!steamService.currentSteamId()) {
    return steamService.restoreSession().pipe(
      map((authenticated) => authenticated ? true : router.createUrlTree(['/login'])),
    );
  }
  return true;
}

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'games',
    loadComponent: () =>
      import('./pages/games/games.component').then((m) => m.GamesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'games/:appId',
    loadComponent: () =>
      import('./pages/game-detail/game-detail.component').then((m) => m.GameDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
