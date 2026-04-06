import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SteamAuthStrategy } from './steam.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'steam' }),
  ],
  controllers: [AuthController],
  providers: [SteamAuthStrategy],
})
export class AuthModule {}
