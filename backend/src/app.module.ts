import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { SteamModule } from './steam/steam.module';
import { MediaModule } from './media/media.module';
import { AuthModule } from './auth/auth.module';
import { MediaEntity } from './media/entities/media.entity';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: join(process.cwd(), 'data', 'steam-achievements.sqlite'),
      autoSave: true,
      entities: [MediaEntity],
      synchronize: true,
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
  ],
})
export class AppModule {}
