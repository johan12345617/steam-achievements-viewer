import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SteamAuthStrategy } from './steam.strategy';
import { SteamSessionGuard } from './steam-session.guard';
import { MobileAuthService } from './mobile-auth.service';
import { MobileSteamVerifier } from './mobile-steam-verifier';
import { SteamCallbackGuard } from './steam-callback.guard';
import { SteamIdentityService } from './steam-identity.service';
import { SteamModule } from '../steam/steam.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'steam' }),
    SteamModule,
  ],
  controllers: [AuthController],
  providers: [SteamAuthStrategy, SteamSessionGuard, MobileAuthService, MobileSteamVerifier, SteamCallbackGuard, SteamIdentityService],
  exports: [SteamSessionGuard, MobileAuthService],
})
export class AuthModule {}
