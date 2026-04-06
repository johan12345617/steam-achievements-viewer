import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaService } from '../../services/media.service';
import { Achievement, AchievementMedia } from '../../models/steam.models';

@Component({
  selector: 'app-upload-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      (click)="onBackdropClick($event)"
    >
      <!-- Modal -->
      <div
        class="bg-steam-card border border-steam-border rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-start justify-between p-6 border-b border-steam-border">
          <div>
            <h2 class="text-xl font-bold text-steam-text-bright">Add Media</h2>
            <p class="text-steam-muted text-sm mt-1">
              Upload a screenshot or video for
              <span class="text-steam-accent font-medium">{{ achievement.name }}</span>
              achivement
            </p>
          </div>
          <button
            (click)="onClose()"
            class="p-2 rounded-lg text-steam-muted hover:text-steam-text hover:bg-white/5 transition-colors duration-200 ml-4 flex-shrink-0"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">

          <!-- File type tabs -->
          <div class="flex gap-2 p-1 bg-steam-darker rounded-lg">
            <button
              (click)="selectedType.set('image')"
              [class]="selectedType() === 'image'
                ? 'flex-1 py-2 px-4 rounded-md bg-steam-accent text-white text-sm font-semibold transition-all duration-200'
                : 'flex-1 py-2 px-4 rounded-md text-steam-muted text-sm font-medium hover:text-steam-text transition-all duration-200'"
            >
              <span class="flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image
              </span>
            </button>
            <button
              (click)="selectedType.set('video')"
              [class]="selectedType() === 'video'
                ? 'flex-1 py-2 px-4 rounded-md bg-steam-accent text-white text-sm font-semibold transition-all duration-200'
                : 'flex-1 py-2 px-4 rounded-md text-steam-muted text-sm font-medium hover:text-steam-text transition-all duration-200'"
            >
              <span class="flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Video
              </span>
            </button>
          </div>

          <!-- Drop zone -->
          <div
            class="relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer"
            [class]="dragOver()
              ? 'border-steam-accent bg-steam-accent/10'
              : 'border-steam-border hover:border-steam-accent/50 hover:bg-white/2'"
            (dragover)="onDragOver($event)"
            (dragleave)="dragOver.set(false)"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            <input
              #fileInput
              type="file"
              [accept]="acceptTypes()"
              class="hidden"
              (change)="onFileSelected($event)"
            />

            @if (previewUrl()) {
              <!-- Preview -->
              <div class="relative rounded-xl overflow-hidden">
                @if (selectedType() === 'image') {
                  <img
                    [src]="previewUrl()"
                    alt="Preview"
                    class="w-full h-48 object-cover rounded-xl"
                  />
                } @else {
                  <video
                    [src]="previewUrl()"
                    class="w-full h-48 object-cover rounded-xl"
                    controls
                  ></video>
                }
                <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-xl">
                  <span class="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-lg">Click to change</span>
                </div>
              </div>
            } @else {
              <!-- Upload prompt -->
              <div class="flex flex-col items-center justify-center py-10 px-6 text-center">
                <div class="w-12 h-12 rounded-full bg-steam-accent/10 border border-steam-accent/20 flex items-center justify-center mb-3">
                  <svg class="w-6 h-6 text-steam-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p class="text-steam-text font-medium">Drop your {{ selectedType() }} here</p>
                <p class="text-steam-muted text-sm mt-1">or click to browse</p>
                <p class="text-steam-muted text-xs mt-2">
                  @if (selectedType() === 'image') {
                    JPG, PNG, GIF, WEBP · Max 10MB
                  } @else {
                    MP4, WEBM, MOV · Max 100MB
                  }
                </p>
              </div>
            }
          </div>

          <!-- Error message -->
          @if (errorMessage()) {
            <div class="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ errorMessage() }}
            </div>
          }

          <!-- Caption field -->
          <div>
            <label class="block text-steam-text text-sm font-medium mb-2">
              Caption <span class="text-steam-muted font-normal">(optional)</span>
            </label>
            <input
              type="text"
              [(ngModel)]="caption"
              placeholder="Add a caption to your media..."
              class="input-steam"
              maxlength="200"
            />
          </div>

          <!-- Existing media -->
          @if (existingMedia().length > 0) {
            <div>
              <h3 class="text-steam-muted text-xs font-semibold uppercase tracking-wider mb-3">Existing Media</h3>
              <div class="grid grid-cols-3 gap-2">
                @for (item of existingMedia(); track item.id) {
                  <div class="relative group rounded-lg overflow-hidden border border-steam-border aspect-video bg-steam-darker">
                    @if (item.type === 'image') {
                      <img [src]="item.url" [alt]="item.caption || 'Media'" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-steam-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    }
                    <button
                      (click)="deleteMedia(item)"
                      class="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            </div>
          }

        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-6 border-t border-steam-border">
          <button
            (click)="onClose()"
            class="btn-secondary text-sm"
            [disabled]="uploading()"
          >
            Cancel
          </button>
          <button
            (click)="onUpload()"
            class="btn-primary text-sm min-w-[120px]"
            [disabled]="!selectedFile() || uploading()"
            [class.opacity-50]="!selectedFile() || uploading()"
            [class.cursor-not-allowed]="!selectedFile() || uploading()"
          >
            @if (uploading()) {
              <span class="flex items-center gap-2 justify-center">
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </span>
            } @else {
              Upload
            }
          </button>
        </div>

      </div>
    </div>
  `,
})
export class UploadModalComponent {
  @Input({ required: true }) achievement!: Achievement;
  @Input({ required: true }) appId!: number;
  @Output() closed = new EventEmitter<void>();
  @Output() uploaded = new EventEmitter<AchievementMedia>();

  private mediaService = inject(MediaService);

  selectedType = signal<'image' | 'video'>('image');
  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  caption = '';
  uploading = signal(false);
  errorMessage = signal('');
  dragOver = signal(false);
  existingMedia = signal<AchievementMedia[]>([]);

  acceptTypes = computed(() =>
    this.selectedType() === 'image'
      ? 'image/jpeg,image/png,image/gif,image/webp'
      : 'video/mp4,video/webm,video/quicktime'
  );

  ngOnInit(): void {
    this.loadExistingMedia();
  }

  loadExistingMedia(): void {
    this.mediaService
      .getAchievementMedia(this.achievement.apiName, this.appId)
      .subscribe((media) => this.existingMedia.set(media));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  processFile(file: File): void {
    this.errorMessage.set('');

    // Auto-detect type
    if (file.type.startsWith('image/')) {
      this.selectedType.set('image');
    } else if (file.type.startsWith('video/')) {
      this.selectedType.set('video');
    }

    this.selectedFile.set(file);

    // Generate preview URL
    const reader = new FileReader();
    reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  onUpload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.errorMessage.set('');

    this.mediaService
      .uploadAchievementMedia({
        achievementApiName: this.achievement.apiName,
        appId: this.appId,
        file,
        type: this.selectedType(),
        caption: this.caption || undefined,
      })
      .subscribe({
        next: (media) => {
          this.uploading.set(false);
          this.uploaded.emit(media);
          this.onClose();
        },
        error: (err: Error) => {
          this.uploading.set(false);
          this.errorMessage.set(err.message ?? 'Upload failed. Please try again.');
        },
      });
  }

  deleteMedia(item: AchievementMedia): void {
    this.mediaService
      .deleteAchievementMedia(item.id, this.achievement.apiName)
      .subscribe(() => {
        this.existingMedia.update((media) => media.filter((m) => m.id !== item.id));
      });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closed.emit();
  }
}
