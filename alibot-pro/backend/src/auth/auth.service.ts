import {
  Injectable, UnauthorizedException, BadRequestException, Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ── Token helpers ──────────────────────────────────────────────────────────

  private signAccess(userId: string) {
    return this.jwt.sign(
      { sub: userId },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '15m' },
    );
  }

  private signRefresh(userId: string) {
    return this.jwt.sign(
      { sub: userId },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '30d' },
    );
  }

  async issueTokensPublic(user: User, res: any) {
    return this.issueTokens(user, res);
  }

  private async issueTokens(user: User, res: any) {
    const access_token = this.signAccess(user.id);
    const refresh = this.signRefresh(user.id);
    await this.users.saveRefreshToken(user.id, refresh);

    res.cookie(REFRESH_COOKIE, refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      maxAge: REFRESH_TTL_SEC * 1000,
      path: '/',
    });

    return { access_token, user: this.users.toPublic(user) };
  }

  // ── Public methods ─────────────────────────────────────────────────────────

  async register(email: string, password: string, res: any) {
    const user = await this.users.create(email, password);
    return this.issueTokens(user, res);
  }

  async login(email: string, password: string, res: any) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await this.users.validatePassword(user, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user, res);
  }

  async logout(userId: string, res: any) {
    await this.users.saveRefreshToken(userId, null);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { message: 'Logged out' };
  }

  async forgotPassword(email: string): Promise<{ reset_url?: string; message: string }> {
    const user = await this.users.findByEmail(email);
    // Always respond the same way to prevent email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.users.saveResetToken(user.id, token, expires);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    // Log to console (visible in server terminal)
    this.logger.log(`[PASSWORD RESET] ${email} → ${resetUrl}`);

    // Return link directly so it works without email configuration
    return {
      message: 'Reset link generated. If email is not configured, use the link below.',
      reset_url: resetUrl,
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.users.findByResetToken(token);
    if (!user) throw new BadRequestException('Invalid or expired reset token');
    if (newPassword.length < 6) throw new BadRequestException('Password must be at least 6 characters');
    await this.users.updatePassword(user.id, newPassword);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (user.password_hash) {
      const valid = await this.users.validatePassword(user, currentPassword);
      if (!valid) throw new BadRequestException('סיסמה נוכחית שגויה');
    }
    if (newPassword.length < 6) throw new BadRequestException('הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
    await this.users.updatePassword(user.id, newPassword);
  }

  async refresh(req: any, res: any) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');

    let payload: { sub: string };
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const valid = await this.users.validateRefreshToken(payload.sub, token);
    if (!valid) throw new UnauthorizedException('Refresh token revoked');

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user, res);
  }
}
