import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Task, TaskSchema } from '@modules/tasks/schemas/task.schema';
import { Project, ProjectSchema } from '@modules/projects/schemas/project.schema';
import { Sprint, SprintSchema } from '@modules/sprints/schemas/sprint.schema';
import { User, UserSchema } from '@modules/users/schemas/user.schema';
import {
  Notification,
  NotificationSchema,
} from '@modules/notifications/schemas/notification.schema';
import {
  ActivityLog,
  ActivityLogSchema,
} from '@modules/activity/schemas/activity-log.schema';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';

/**
 * Read-only reporting module — it aggregates over data other modules own and
 * writes nothing itself.
 *
 * Every schema is registered directly with `forFeature()` rather than
 * importing Tasks/Projects/Sprints/Notifications/Activity, per the module
 * dependency rule: the dashboard needs raw model access for aggregation, not
 * those modules' services, and importing all six would drag half the app's
 * dependency graph in behind them. WorkspacesModule is a real import because
 * membership checking is genuinely `WorkspacesService.findOne()`'s job.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Sprint.name, schema: SprintSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    WorkspacesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
