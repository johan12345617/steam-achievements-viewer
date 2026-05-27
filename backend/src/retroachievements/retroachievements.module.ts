import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RetroAchievementsController } from './retroachievements.controller';
import { RetroAchievementsService } from './retroachievements.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [RetroAchievementsController],
  providers: [RetroAchievementsService],
})
export class RetroAchievementsModule {}
