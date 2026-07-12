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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
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
import { Throttle } from '@common/decorators/throttle.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: AppConfigService,
  ) {}

  // ─── Login ──────────────────────────────────────────────────────
  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful — access_token and refresh_token cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or deactivated account' })
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
  @ApiOperation({ summary: 'Validate a workspace invite token before registration' })
  @ApiParam({ name: 'token', description: 'Invite token from the email link' })
  @ApiResponse({ status: 200, description: 'Token is valid — returns invited email and role' })
  @ApiResponse({ status: 400, description: 'Token is invalid, already used, or expired' })
  validateInvite(@Param('token') token: string) {
    return this.authService.validateInvite(token);
  }

  // ─── Register ───────────────────────────────────────────────────
  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account using a workspace invite token' })
  @ApiResponse({ status: 201, description: 'Registration successful — access_token and refresh_token cookies set' })
  @ApiResponse({ status: 400, description: 'Invite token is invalid or expired' })
  @ApiResponse({ status: 409, description: 'An account with this email already exists' })
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
  @ApiOperation({ summary: 'Refresh access and refresh tokens using the refresh_token cookie' })
  @ApiCookieAuth('cookie-refresh-token')
  @ApiResponse({ status: 200, description: 'New tokens issued — both cookies updated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid refresh_token cookie' })
  async refresh(
    @CurrentUser() user: UserDocument & { tokenId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.refresh(
      user,
      user.tokenId,
    );
    this.setTokenCookies(res, accessToken, refreshToken);
    return { message: 'Tokens refreshed' };
  }

  // ─── Logout ─────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out — blacklists the refresh token and clears cookies' })
  @ApiCookieAuth('cookie-access-token')
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async logout(
    @CurrentUser() user: UserDocument & { tokenId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.tokenId);
    res.clearCookie('access_token');
    // must match the path used in setTokenCookies() — clearCookie only
    // deletes a cookie whose path attribute matches exactly, otherwise
    // the browser treats it as an unrelated cookie and it survives
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
    return { message: 'Logged out successfully' };
  }

  // ─── Forgot Password ────────────────────────────────────────────
  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Always returns 200 to prevent email enumeration — email sent if account exists' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // ─── Reset Password ─────────────────────────────────────────────
  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using the token from the reset email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Reset token is invalid or has expired' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Me ─────────────────────────────────────────────────────────
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiCookieAuth('cookie-access-token')
  @ApiResponse({ status: 200, description: 'Returns current user profile (password fields excluded)' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
