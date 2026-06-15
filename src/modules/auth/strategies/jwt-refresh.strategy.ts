import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AppConfigService } from '@config/config.service';
import { JwtRefreshPayload } from '../types/jwt-payload.interface';
import { User, UserDocument } from '@modules/users/schemas/user.schema';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: AppConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['refresh_token'] ?? null,
      ]),
      secretOrKey: config.jwtRefreshSecret,
      ignoreExpiration: false,
      passReqToCallback: true, // we need the raw token for rotation
    });
  }

  async validate(
    req: Request,
    payload: JwtRefreshPayload,
  ): Promise<User & { refreshToken: string; tokenId: string }> {
    const user = await this.userModel.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      ...user.toObject(),
      refreshToken: req.cookies?.['refresh_token'],
      tokenId: payload.tokenId,
    };
  }
}
