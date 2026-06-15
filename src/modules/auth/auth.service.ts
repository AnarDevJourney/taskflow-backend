import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SignOptions } from 'jsonwebtoken';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppConfigService } from '@config/config.service';
import { User, UserDocument } from '@modules/users/schemas/user.schema';
import { Invite, InviteDocument } from './schemas/invite.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload, JwtRefreshPayload } from './types/jwt-payload.interface';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';
import { EmailService } from '@modules/notifications/email.service';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    private jwtService: JwtService,
    private config: AppConfigService,
    private emailService: EmailService,
  ) {}

  // ─── Login ──────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+password');

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.userModel.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
    });

    return this.issueTokens(user);
  }

  // ─── Validate Invite ────────────────────────────────────────────
  async validateInvite(token: string) {
    const invite = await this.inviteModel.findOne({ token });

    if (!invite) {
      throw new BadRequestException(
        'Invite link is invalid or has already been used',
      );
    }

    if (invite.expiresAt < new Date()) {
      await this.inviteModel.deleteOne({ token });
      throw new BadRequestException(
        'Invite link has expired — ask your admin to send a new one',
      );
    }

    return { email: invite.email, role: invite.role };
  }

  // ─── Register ───────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const invite = await this.inviteModel.findOne({ token: dto.token });

    if (!invite) {
      throw new BadRequestException(
        'Invite link is invalid or has already been used',
      );
    }

    if (invite.expiresAt < new Date()) {
      await this.inviteModel.deleteOne({ token: dto.token });
      throw new BadRequestException('Invite link has expired');
    }

    const existingUser = await this.userModel.findOne({ email: invite.email });

    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists — try logging in',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userModel.create({
      name: dto.name,
      email: invite.email,
      password: hashedPassword,
    });

    // delete invite so it can't be reused
    await this.inviteModel.deleteOne({ token: dto.token });

    this.logger.log(`New user registered: ${user.email}`);

    return this.issueTokens(user);
  }

  // ─── Refresh Tokens ─────────────────────────────────────────────
  async refresh(user: UserDocument) {
    return this.issueTokens(user);
  }

  // ─── Forgot Password ────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    });

    // always return success even if user not found — prevent email enumeration
    if (!user) return;

    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.userModel.findByIdAndUpdate(user._id, {
      passwordResetToken: resetToken,
      passwordResetExpiresAt: expiresAt,
    });

    // TODO: fire email job with reset link
    this.logger.log(`Password reset requested for ${user.email}`);
  }

  // ─── Reset Password ─────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userModel.findOne({
      passwordResetToken: dto.token,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });
  }

  // ─── Create Invite ──────────────────────────────────────────────
  async createInvite(
    email: string,
    role: WorkspaceRole,
    workspaceId: string,
    invitedBy: string,
    inviterName: string,
    workspaceName: string,
  ) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 72); // 72 hours

    await this.inviteModel.create({
      token,
      email: email.toLowerCase(),
      role,
      workspaceId,
      invitedBy,
      expiresAt,
    });

    const inviteUrl = `${this.config.appUrl}/register?token=${token}`;
    await this.emailService.sendInvite(email, {
      inviterName,
      workspaceName,
      role,
      inviteUrl,
    });

    this.logger.log(`Invite created for ${email} (role: ${role})`);

    return token;
  }

  // ─── Token helpers ──────────────────────────────────────────────
  private issueTokens(user: UserDocument) {
    const userId = (user._id as any).toString();

    const accessPayload: JwtPayload = {
      sub: userId,
      email: user.email,
      workspaceId: '', // will be set properly once workspaces module is done
      role: '',
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      tokenId: randomBytes(16).toString('hex'),
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.jwtSecret,
      expiresIn: this.config.jwtExpiresIn as SignOptions['expiresIn'],
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: this.config.jwtRefreshExpiresIn as SignOptions['expiresIn'],
    });

    return { accessToken, refreshToken, user };
  }
}
