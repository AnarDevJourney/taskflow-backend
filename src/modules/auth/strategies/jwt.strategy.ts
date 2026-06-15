import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AppConfigService } from '@config/config.service';
import { JwtPayload } from '../types/jwt-payload.interface';
import { User, UserDocument } from '@modules/users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      // extract token from cookie first, fallback to Authorization header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['access_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: config.jwtSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.userModel.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}
