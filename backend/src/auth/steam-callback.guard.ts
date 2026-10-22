import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { MobileAuthService } from './mobile-auth.service';
import { MobileSteamVerifier } from './mobile-steam-verifier';

@Injectable()
export class SteamCallbackGuard extends AuthGuard('steam') {
  constructor(private readonly mobileAuth: MobileAuthService, private readonly verifier: MobileSteamVerifier) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.query.mobile === undefined) return super.canActivate(context) as Promise<boolean>;
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const transactionId = this.mobileAuth.assertBrowserTransaction(req);
    if (req.query['openid.mode'] === 'cancel') {
      res.redirect(this.mobileAuth.fail(transactionId, res, 'access_denied'));
      return false;
    }
    try {
      req.user = await this.verifier.verify(req, res, this.mobileAuth.returnUrl(transactionId), this.mobileAuth.backendUrl);
      return true;
    } catch {
      res.redirect(this.mobileAuth.fail(transactionId, res));
      return false;
    }
  }
}
