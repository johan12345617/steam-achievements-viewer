import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import * as passport from 'passport';
import { SteamSessionUser } from './steam-session';
import { SteamIdentityService } from './steam-identity.service';

const SteamStrategy = require('passport-steam').Strategy;

/** The only upstream authentication boundary. Tests replace this provider, never an HTTP bypass. */
@Injectable()
export class MobileSteamVerifier {
  constructor(private readonly identity: SteamIdentityService) {}

  verify(req: Request, res: Response, returnUrl: string, realm: string): Promise<SteamSessionUser> {
    if (req.query['openid.mode'] !== 'id_res') {
      return Promise.reject(new UnauthorizedException('Steam sign-in was not completed.'));
    }
    // A fresh strategy keeps each concurrent request's expected return_to isolated.
    const strategy = new SteamStrategy({
      returnURL: returnUrl,
      realm,
      profile: false,
    }, (identifier: string, profile: any, done: (err: unknown, user?: SteamSessionUser | false) => void) => {
      this.identity.resolveVerifiedIdentifier(identifier).then(user => done(null, user), error => done(error));
    });
    return new Promise((resolve, reject) => {
      passport.authenticate(strategy, { session: false }, (err: unknown, user: SteamSessionUser | false) => {
        if (err || !user) return reject(new UnauthorizedException('Steam could not verify this sign-in.'));
        resolve(user);
      })(req, res, (err: unknown) => reject(err || new UnauthorizedException('Steam sign-in failed.')));
    });
  }
}
