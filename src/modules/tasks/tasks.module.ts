import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksQueryService } from './tasks-query.service';
import { Task, TaskSchema } from './schemas/task.schema';
import { ProjectsModule } from '@modules/projects/projects.module';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';
import { ActivityModule } from '@modules/activity/activity.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    ProjectsModule, // TasksService needs ProjectsService
    WorkspacesModule, // TasksService needs WorkspacesService
    ActivityModule,
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksQueryService],
  exports: [TasksService], // CommentsModule and SprintsModule will need this
})
export class TasksModule {}
