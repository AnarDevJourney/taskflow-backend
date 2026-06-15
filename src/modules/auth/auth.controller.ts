import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { AppConfigService } from '@config/config.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: AppConfigService,
  ) {}

  // ─── Login ──────────────────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setTokenCookies(res, accessToken, refreshToken);
    return { user: this.sanitizeUser(user) };
  }

  // ─── Validate Invite ────────────────────────────────────────────
  @Public()
  @Get('invite/:token')
  validateInvite(@Param('token') token: string) {
    return this.authService.validateInvite(token);
  }

  // ─── Register ───────────────────────────────────────────────────
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);
    this.setTokenCookies(res, accessToken, refreshToken);
    return { user: this.sanitizeUser(user) };
  }

  // ─── Refresh ────────────────────────────────────────────────────
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: UserDocument,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.refresh(user);
    this.setTokenCookies(res, accessToken, refreshToken);
    return { message: 'Tokens refreshed' };
  }

  // ─── Logout ─────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  // ─── Forgot Password ────────────────────────────────────────────
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // ─── Reset Password ─────────────────────────────────────────────
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Me ─────────────────────────────────────────────────────────
  @Get('me')
  me(@CurrentUser() user: UserDocument) {
    return this.sanitizeUser(user);
  }

  // ─── Helpers ────────────────────────────────────────────────────
  private setTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = this.config.isProduction;

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes in ms
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: '/api/v1/auth/refresh', // refresh token only sent to this endpoint
    });
  }

  private sanitizeUser(user: UserDocument) {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpiresAt;
    return obj;
  }
}
