import { Module } from '@nestjs/common';
import { MediaController, SanMediaController } from './media.controller';
import { MediaService } from './media.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MediaController, SanMediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
