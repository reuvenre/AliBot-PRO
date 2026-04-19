import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(config: ConfigService, private users: UsersService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') || 'MISSING';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || 'MISSING';
    const backendUrl = config.get<string>('BACKEND_URL') || 'http://localhost:3001';

    if (clientID === 'MISSING' || clientSecret === 'MISSING') {
      // Log warning but don't crash — Google login just won't work
      new Logger('GoogleStrategy').warn(
        'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — Google OAuth disabled',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL: `${backendUrl}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Google'), undefined);

    const user = await this.users.findOrCreateGoogle(
      email,
      profile.id,
      profile.displayName,
    );
    done(null, user);
  }
}
