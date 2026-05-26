import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AchievementMedia } from '../../models/steam.models';

@Component({
  selector: 'app-media-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      (click)="onBackdropClick()"
    >
      <!-- Modal container -->
      <div
        [ngClass]="isFullscreen()
          ? 'relative flex flex-col w-screen h-screen max-w-none mx-0 max-h-none'
          : 'relative flex flex-col w-full max-w-5xl mx-4 max-h-[90vh]'"
        (click)="$event.stopPropagation()"
      >

        <!-- Header bar -->
        <div
          [ngClass]="isFullscreen()
            ? 'flex items-center justify-between px-4 py-3 bg-steam-darker/90 border-b border-steam-border'
            : 'flex items-center justify-between px-4 py-3 bg-steam-darker/90 border border-steam-border rounded-t-2xl'"
        >
          <!-- Achievement name + media type -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex items-center gap-1.5">
              @if (currentItem().type === 'image') {
                <svg class="w-4 h-4 text-steam-teal flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="text-xs font-semibold text-steam-teal uppercase tracking-wider">Image</span>
              } @else {
                <svg class="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-xs font-semibold text-purple-400 uppercase tracking-wider">Video</span>
              }
            </div>

            @if (currentItem().caption) {
              <span class="text-steam-text text-sm truncate">{{ currentItem().caption }}</span>
            }
          </div>

          <!-- Counter + actions -->
          <div class="flex items-center gap-3 flex-shrink-0">
            @if (media.length > 1) {
              <span class="text-steam-muted text-xs">{{ currentIndex() + 1 }} / {{ media.length }}</span>
            }
            <button
              (click)="toggleFullscreen($event)"
              class="w-8 h-8 rounded-lg bg-steam-card hover:bg-steam-accent/20 border border-steam-border hover:border-steam-accent/40 flex items-center justify-center transition-all duration-200 group"
              [title]="isFullscreen() ? 'Exit fullscreen (F)' : 'Fullscreen (F)'"
            >
              @if (isFullscreen()) {
                <svg class="w-4 h-4 text-steam-muted group-hover:text-steam-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9H5V5m0 0l5 5m5-5h4v4m0-4l-5 5M9 15H5v4m0 0l5-5m5 5h4v-4m0 4l-5-5" />
                </svg>
              } @else {
                <svg class="w-4 h-4 text-steam-muted group-hover:text-steam-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 9V4h5M4 4l6 6m10-1V4h-5m5 0l-6 6M4 15v5h5m-5 0l6-6m10 1v5h-5m5 0l-6-6" />
                </svg>
              }
            </button>
            <button
              (click)="close.emit()"
              class="w-8 h-8 rounded-lg bg-steam-card hover:bg-red-500/20 border border-steam-border hover:border-red-500/40 flex items-center justify-center transition-all duration-200 group"
              title="Close (Esc)"
            >
              <svg class="w-4 h-4 text-steam-muted group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Media area -->
        <div
          [ngClass]="isFullscreen()
            ? 'relative bg-black flex flex-1 items-center justify-center min-h-0 overflow-hidden border-x border-steam-border'
            : 'relative bg-black flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden border-x border-steam-border'"
        >

          <!-- Left arrow -->
          @if (hasPrev()) {
            <button
              (click)="prev()"
              class="absolute left-3 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-steam-accent/80 border border-white/10 hover:border-steam-accent flex items-center justify-center transition-all duration-200 group shadow-lg"
              title="Previous (←)"
            >
              <svg class="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          }

          <!-- Right arrow -->
          @if (hasNext()) {
            <button
              (click)="next()"
              class="absolute right-3 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-steam-accent/80 border border-white/10 hover:border-steam-accent flex items-center justify-center transition-all duration-200 group shadow-lg"
              title="Next (→)"
            >
              <svg class="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          }

          <!-- Image viewer -->
          @if (currentItem().type === 'image') {
            <img
              [src]="currentItem().url"
              [alt]="currentItem().caption || 'Achievement media'"
              [ngClass]="isFullscreen()
                ? 'max-w-full max-h-full object-contain select-none bg-black'
                : 'max-w-full max-h-[70vh] object-contain select-none bg-black'"
              draggable="false"
            />
          }

          <!-- Video viewer -->
          @if (currentItem().type === 'video') {
            <video
              [src]="currentItem().url"
              controls
              autoplay
              [ngClass]="isFullscreen()
                ? 'max-w-full max-h-full outline-none'
                : 'max-w-full max-h-[70vh] outline-none'"
              (click)="$event.stopPropagation()"
            >
              Your browser does not support the video tag.
            </video>
          }
        </div>

        <!-- Thumbnail strip (only when more than 1 item) -->
        @if (media.length > 1) {
          <div
            [ngClass]="isFullscreen()
              ? 'flex items-center gap-3 p-3 bg-steam-darker/90 border-t border-steam-border overflow-x-auto'
              : 'flex items-center gap-3 p-3 bg-steam-darker/90 border border-steam-border rounded-b-2xl overflow-x-auto'"
          >
            @for (item of media; track item.id; let i = $index) {
              <button
                (click)="goTo(i)"
                class="flex-shrink-0 w-28 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 relative bg-steam-card"
                [class]="i === currentIndex()
                  ? 'border-steam-accent shadow-[0_0_8px_rgba(79,158,237,0.5)]'
                  : 'border-steam-border hover:border-steam-border/80 opacity-60 hover:opacity-100'"
              >
                @if (item.type === 'image') {
                  <img
                    [src]="item.thumbnailUrl ?? item.url"
                    [alt]="item.caption || 'Thumbnail'"
                    class="w-full h-full object-cover"
                  />
                } @else {
                  <div class="w-full h-full bg-steam-card flex items-center justify-center">
                    <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                }
                <span
                  class="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-semibold uppercase tracking-wider"
                  [class]="item.type === 'image' ? 'text-steam-teal' : 'text-purple-300'"
                >
                  {{ item.type }}
                </span>
              </button>
            }
          </div>
        } @else {
          <!-- No strip needed — round the bottom of the media area -->
          <div class="h-0 border-x border-b border-steam-border rounded-b-2xl"></div>
        }

      </div>
    </div>
  `,
})
export class MediaViewerComponent implements OnInit {
  @Input({ required: true }) media: AchievementMedia[] = [];
  @Input() startIndex = 0;
  @Output() close = new EventEmitter<void>();

  currentIndex = signal(0);
  isFullscreen = signal(false);

  currentItem = computed(() => this.media[this.currentIndex()]);
  hasPrev = computed(() => this.currentIndex() > 0);
  hasNext = computed(() => this.currentIndex() < this.media.length - 1);

  ngOnInit(): void {
    this.currentIndex.set(this.startIndex);
  }

  prev(): void {
    if (this.hasPrev()) this.currentIndex.update((i) => i - 1);
  }

  next(): void {
    if (this.hasNext()) this.currentIndex.update((i) => i + 1);
  }

  goTo(index: number): void {
    this.currentIndex.set(index);
  }

  toggleFullscreen(event?: Event): void {
    event?.stopPropagation();
    this.isFullscreen.update((value) => !value);
  }

  onBackdropClick(): void {
    this.close.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        if (this.isFullscreen()) {
          this.isFullscreen.set(false);
          return;
        }
        this.close.emit();
        break;
      case 'f':
      case 'F':
        this.toggleFullscreen(event);
        break;
      case 'ArrowLeft':
        this.prev();
        break;
      case 'ArrowRight':
        this.next();
        break;
    }
  }
}
