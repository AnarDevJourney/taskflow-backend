import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';
import { ProjectsModule } from '@modules/projects/projects.module';
import { TasksModule } from '@modules/tasks/tasks.module';
import { CommentsModule } from '@modules/comments/comments.module';
import { SprintsModule } from '@modules/sprints/sprints.module';
import { ActivityModule } from './modules/activity/activity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FilesModule } from './modules/files/files.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    SprintsModule,
    ActivityModule,
    NotificationsModule,
    FilesModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
