import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityController } from './activity.controller';
import { WorkspaceActivityController } from './workspace-activity.controller';
import { ActivityService } from './activity.service';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-log.schema';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    WorkspacesModule, // WorkspaceActivityController checks membership via WorkspacesService.findOne()
  ],
  controllers: [ActivityController, WorkspaceActivityController],
  providers: [ActivityService],
  exports: [ActivityService], // TasksService, CommentsService etc. will import this
})
export class ActivityModule {}
