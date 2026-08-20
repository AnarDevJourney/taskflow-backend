import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AvatarResolver } from './resolvers/avatar.resolver';
import { User, UserSchema } from './schemas/user.schema';

// Standalone: only the User schema is needed, and MinioService comes from the
// global StorageModule.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService, AvatarResolver],
  exports: [UsersService],
})
export class UsersModule {}
