import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    // no feature module deps — ActivityService is called BY other services
    // not the other way around
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService], // TasksService, CommentsService etc. will import this
})
export class ActivityModule {}
