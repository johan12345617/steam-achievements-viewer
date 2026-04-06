import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SteamController } from './steam.controller';
import { SteamService } from './steam.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [SteamController],
  providers: [SteamService],
  exports: [SteamService],
})
export class SteamModule {}
