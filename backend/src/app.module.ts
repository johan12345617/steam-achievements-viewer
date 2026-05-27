import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SteamModule } from './steam/steam.module';
import { MediaModule } from './media/media.module';
import { AuthModule } from './auth/auth.module';
import { RetroAchievementsModule } from './retroachievements/retroachievements.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 500,
      },
    ]),
    SteamModule,
    MediaModule,
    AuthModule,
    RetroAchievementsModule,
  ],
})
export class AppModule {}
