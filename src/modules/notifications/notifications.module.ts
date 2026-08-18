import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsScheduler } from './notifications.scheduler';
import { EmailService } from './email.service';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { User, UserSchema } from '@modules/users/schemas/user.schema';
import { Task, TaskSchema } from '@modules/tasks/schemas/task.schema';
import {
  Project,
  ProjectSchema,
} from '@modules/projects/schemas/project.schema';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      // schemas only (no TasksModule / ProjectsModule import) — those modules
      // already depend on this one, importing them back would be circular
      { name: User.name, schema: UserSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
    JwtModule.register({}), // gateway needs JwtService to verify socket tokens
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsProcessor,
    NotificationsScheduler,
    EmailService,
  ],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
