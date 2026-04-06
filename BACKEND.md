# Backend Architecture Guide

## Why a Backend Is Required

This app currently runs in demo mode with mock data. To connect to the real Steam Web API and support user media uploads, a backend server is **required** for these reasons:

### 1. Steam API Key Security
Steam Web API requires an API key (obtainable at https://steamcommunity.com/dev/apikey).
**You must never expose this key in the frontend JavaScript** — it would be visible in the browser's source and could be stolen. All Steam API requests must be proxied through a backend.

### 2. CORS Restrictions
The Steam Web API does not return CORS headers that allow browser-based requests. Calling it directly from Angular would be blocked by the browser. A backend server makes the requests server-side and relays the response.

### 3. File Uploads
Browser uploads create temporary `blob:` URLs that disappear when the tab is closed. A backend is needed to:
- Receive multipart form data
- Validate and process files (resize images, transcode video)
- Persist files to cloud/disk storage
- Return stable, publicly accessible URLs

### 4. Rate Limiting & Caching
Steam Web API has rate limits. A backend can cache responses (e.g., with Redis or in-memory) to avoid redundant calls and improve performance.

---

## Suggested Stack

### Option A: Node.js + Express (simple, familiar)
```
npm install express cors helmet multer axios dotenv
npm install -D typescript @types/express @types/node ts-node-dev
```

### Option B: NestJS (scalable, Angular-compatible)
```
npm install -g @nestjs/cli
nest new steam-achievements-api
```

NestJS is recommended if you plan to grow the project — it uses decorators and DI patterns similar to Angular.

### Option C: Node.js + Fastify (high performance)
```
npm install fastify @fastify/cors @fastify/multipart axios
```

---

## API Endpoints to Implement

### Player Profile
```
GET /api/player/:steamId
```
Fetches player summary. Calls Steam:
```
http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={KEY}&steamids={STEAMID}
```

### Owned Games
```
GET /api/games/:steamId
```
Fetches owned games with app info. Calls Steam:
```
http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={KEY}&steamid={STEAMID}&include_appinfo=true&include_played_free_games=true
```

### Player Achievements for a Game
```
GET /api/achievements/:appId/:steamId
```
Merges player progress with schema (achievement names/icons) and global percentages.

Calls Steam:
```
# Player progress
http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid={APPID}&key={KEY}&steamid={STEAMID}

# Achievement schema (names, descriptions, icon hashes)
http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?key={KEY}&appid={APPID}

# Global completion percentages (rarity)
http://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid={APPID}
```

Achievement icon URLs (construct from hash in schema):
```
https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/{APPID}/{ICON_HASH}.jpg
```

### Upload Achievement Media
```
POST /api/upload/:achievementId
Content-Type: multipart/form-data

Body fields:
  - file: File (image or video)
  - appId: number
  - type: "image" | "video"
  - caption?: string
```

### Get Media for Achievement
```
GET /api/media/:achievementId?appId={appId}
```
Returns array of `AchievementMedia` objects with serving URLs.

### Delete Media
```
DELETE /api/media/:mediaId
```

### Resolve Vanity URL to Steam ID
```
GET /api/resolve/:vanityUrl
```
Calls:
```
http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key={KEY}&vanityurl={VANITYURL}
```

---

## Steam OpenID Authentication

For "Sign in with Steam" (the grayed-out button in the login page):

1. Redirect user to:
   ```
   https://steamcommunity.com/openid/login?openid.mode=checkid_setup&openid.ns=http://specs.openid.net/auth/2.0&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.return_to=http://yourbackend.com/auth/steam/callback&openid.realm=http://yourbackend.com
   ```

2. Steam redirects back to your `return_to` URL with the Steam ID encoded in the URL params.

3. Verify the response with Steam's OpenID endpoint and extract the 64-bit Steam ID.

4. Set a session cookie or issue a JWT, then redirect the user to the Angular app.

Useful libraries:
- `passport-steam` (Node.js)
- `openid` npm package

---

## File Storage Options

### 1. Local Filesystem (development only)
```javascript
// Using multer (Express)
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload/:achievementId', upload.single('file'), (req, res) => {
  // File is at req.file.path
  const url = `http://localhost:3000/uploads/${req.file.filename}`;
  res.json({ url });
});

// Serve static files
app.use('/uploads', express.static('uploads'));
```

### 2. Amazon S3
```javascript
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({ region: process.env.AWS_REGION });

const command = new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: `achievements/${achievementId}/${filename}`,
  Body: fileBuffer,
  ContentType: mimeType,
  ACL: 'public-read',
});
await client.send(command);
const url = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/achievements/${achievementId}/${filename}`;
```

### 3. Cloudinary (recommended for media)
```javascript
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const result = await cloudinary.uploader.upload(filePath, {
  folder: `steam-achievements/${appId}/${achievementId}`,
  resource_type: 'auto', // handles both images and videos
  transformation: [{ quality: 'auto', fetch_format: 'auto' }],
});
const url = result.secure_url;
```

Benefits of Cloudinary:
- Automatic image optimization and format conversion (WebP, AVIF)
- Video transcoding and thumbnail generation
- CDN delivery globally
- Free tier available

### 4. Supabase Storage
```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data, error } = await supabase.storage
  .from('achievement-media')
  .upload(`${appId}/${achievementId}/${filename}`, fileBuffer, {
    contentType: mimeType,
    upsert: false,
  });

const { data: urlData } = supabase.storage
  .from('achievement-media')
  .getPublicUrl(data.path);
```

---

## Environment Variables Template (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# Steam Web API
STEAM_API_KEY=your_steam_api_key_here

# CORS — set to your Angular dev server origin
CORS_ORIGIN=http://localhost:4200

# Session / JWT
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# File storage (choose one)
STORAGE_PROVIDER=local  # local | s3 | cloudinary | supabase

# AWS S3 (if using S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=steam-achievements-media

# Cloudinary (if using Cloudinary)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Supabase (if using Supabase)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Database (optional, for persisting user data)
DATABASE_URL=postgresql://user:password@localhost:5432/steam_achievements
```

---

## Connecting the Angular App

Once your backend is running, update `src/app/services/steam.service.ts` and `media.service.ts`:

1. Inject `HttpClient`:
   ```typescript
   constructor(private http: HttpClient) {}
   ```

2. Replace mock `of(...)` calls with real HTTP:
   ```typescript
   getPlayerSummary(steamId: string): Observable<PlayerSummary> {
     return this.http.get<PlayerSummary>(`/api/player/${steamId}`);
   }
   ```

3. Configure a proxy in `proxy.conf.json`:
   ```json
   {
     "/api": {
       "target": "http://localhost:3000",
       "secure": false,
       "changeOrigin": true
     }
   }
   ```

4. Reference the proxy in `angular.json`:
   ```json
   "serve": {
     "options": {
       "proxyConfig": "proxy.conf.json"
     }
   }
   ```
