import {
  Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode, BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthDto } from './dto/auth.dto';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private users: UsersService,
    private config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: AuthDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.register(dto.email, dto.password, res);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: AuthDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto.email, dto.password, res);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout((req.user as any).id, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return this.users.toPublic(req.user as any);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  // ── Password reset ──────────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    return this.auth.forgotPassword(email);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body('token') token: string,
    @Body('password') password: string,
  ) {
    if (!token || !password) throw new BadRequestException('Token and password are required');
    await this.auth.resetPassword(token, password);
    return { message: 'Password updated successfully' };
  }

  // ── Change password ─────────────────────────────────────────────────────────

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(
    @Req() req: Request,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!newPassword) throw new BadRequestException('New password is required');
    await this.auth.changePassword((req.user as any).id, currentPassword || '', newPassword);
    return { message: 'Password changed successfully' };
  }

  // ── Google OAuth ────────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() { /* redirects to Google */ }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    try {
      const { access_token } = await this.auth.issueTokensPublic(req.user as any, res);
      return res.redirect(`${frontendUrl}/google/success?token=${access_token}`);
    } catch {
      return res.redirect(`${frontendUrl}/login?error=google_failed`);
    }
  }
}
