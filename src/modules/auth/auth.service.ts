import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SignOptions } from 'jsonwebtoken';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@common/redis/redis.constants';
import { AppConfigService } from '@config/config.service';
import { User, UserDocument } from '@modules/users/schemas/user.schema';
import { Invite, InviteDocument } from './schemas/invite.schema';
import {
  Workspace,
  WorkspaceDocument,
} from '@modules/workspaces/schemas/workspace.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload, JwtRefreshPayload } from './types/jwt-payload.interface';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';
import { EmailService } from '@modules/notifications/email.service';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour
const REFRESH_BLACKLIST_PREFIX = 'refresh_blacklist:';

const DURATION_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
  w: 60 * 60 * 24 * 7,
};

// parses jwt-style duration strings ('15m', '7d', '3600s') into seconds
function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhdw])$/.exec(duration.trim());
  if (!match) return 60 * 60 * 24 * 7; // safe fallback — 7 days

  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNIT_SECONDS[unit];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
    private jwtService: JwtService,
    private config: AppConfigService,
    private emailService: EmailService,
    @Inject(REDIS_CLIENT) private redis: Redis,
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

    const userExists = !!(await this.userModel.findOne({ email: invite.email }));

    return { email: invite.email, role: invite.role, userExists };
  }

  // ─── Accept Invite (existing account) ────────────────────────────
  // used when the invited email already has an account (e.g. a member
  // was removed from a workspace and is being re-invited) — the user
  // logs in with their existing credentials instead of registering,
  // then this just adds them back as a workspace member
  async acceptInvite(token: string, user: UserDocument) {
    const invite = await this.inviteModel.findOne({ token });

    if (!invite) {
      throw new BadRequestException(
        'Invite link is invalid or has already been used',
      );
    }

    if (invite.expiresAt < new Date()) {
      await this.inviteModel.deleteOne({ token });
      throw new BadRequestException('Invite link has expired');
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException(
        'This invite was sent to a different email address',
      );
    }

    const workspace = await this.workspaceModel.findById(invite.workspaceId);
    if (!workspace) {
      await this.inviteModel.deleteOne({ token });
      throw new BadRequestException('Workspace no longer exists');
    }

    const alreadyMember = workspace.members.some(
      (m) => m.userId.toString() === (user._id as Types.ObjectId).toString(),
    );

    if (!alreadyMember) {
      await this.workspaceModel.findByIdAndUpdate(workspace._id, {
        $push: {
          members: { userId: user._id, role: invite.role, joinedAt: new Date() },
        },
      });
    }

    await this.inviteModel.deleteOne({ token });

    this.logger.log(`${user.email} accepted invite to workspace ${workspace._id}`);

    return { workspaceId: (workspace._id as Types.ObjectId).toString() };
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

    // add the new user as a member of the workspace they were invited to
    await this.workspaceModel.findByIdAndUpdate(invite.workspaceId, {
      $push: { members: { userId: user._id, role: invite.role, joinedAt: new Date() } },
    });

    // delete invite so it can't be reused
    await this.inviteModel.deleteOne({ token: dto.token });

    this.logger.log(`New user registered: ${user.email}`);

    return this.issueTokens(user);
  }

  // ─── Refresh Tokens ─────────────────────────────────────────────
  async refresh(user: UserDocument, tokenId: string) {
    const isBlacklisted = await this.redis.get(
      `${REFRESH_BLACKLIST_PREFIX}${tokenId}`,
    );

    if (isBlacklisted) {
      throw new UnauthorizedException(
        'Refresh token has been revoked — please log in again',
      );
    }

    return this.issueTokens(user);
  }

  // ─── Logout ─────────────────────────────────────────────────────
  // blacklists the token pair's shared jti in Redis so the refresh
  // token can never be used again, even though its JWT signature
  // would otherwise still validate until it expires. We use the
  // access token's tokenId (always available — logout requires it)
  // rather than reading the refresh_token cookie directly, since
  // that cookie is intentionally path-scoped to /auth/refresh only
  // and is never sent to /auth/logout.
  async logout(tokenId: string) {
    const ttlSeconds = parseDurationToSeconds(this.config.jwtRefreshExpiresIn);

    await this.redis.set(
      `${REFRESH_BLACKLIST_PREFIX}${tokenId}`,
      '1',
      'EX',
      ttlSeconds,
    );
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

    const resetUrl = `${this.config.appUrl}/reset-password?token=${resetToken}`;
    await this.emailService.sendPasswordReset(user.email, {
      name: user.name,
      resetUrl,
      lang: dto.lang,
    });

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
    const tokenId = randomBytes(16).toString('hex');

    const accessPayload: JwtPayload = {
      sub: userId,
      email: user.email,
      workspaceId: '', // will be set properly once workspaces module is done
      role: '',
      tokenId,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      tokenId,
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
