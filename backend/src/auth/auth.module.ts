import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SteamAuthStrategy } from './steam.strategy';
import { SteamSessionGuard } from './steam-session.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'steam' }),
  ],
  controllers: [AuthController],
  providers: [SteamAuthStrategy, SteamSessionGuard],
  exports: [SteamSessionGuard],
})
export class AuthModule {}
