export interface MediaEntity {
  id: string;
  achievementApiName: string;
  ownerSteamId: string;
  appId: number;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  filename: string;
  objectKey: string | null;
  recordKey: string | null;
  contentType: string | null;
  sizeBytes: number;
  status: 'pending' | 'ready';
  uploadedAt: Date;
}
