import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { RequestContextMiddleware } from '@common/middleware/request-context.middleware';
import { AppService } from './app.service';
import { AppConfigModule } from '@config/config.module';
import { DatabaseModule } from '@database/database.module';
import { RedisModule } from '@common/redis/redis.module';
import { StorageModule } from '@common/storage/storage.module';
import { QueueModule } from '@common/queue/queue.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';
import { ProjectsModule } from '@modules/projects/projects.module';
import { TasksModule } from '@modules/tasks/tasks.module';
import { CommentsModule } from '@modules/comments/comments.module';
import { SprintsModule } from '@modules/sprints/sprints.module';
import { ActivityModule } from './modules/activity/activity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FilesModule } from './modules/files/files.module';
import { SearchModule } from './modules/search/search.module';
import { TableSettingsModule } from './modules/table-settings/table-settings.module';
import { SidebarSettingsModule } from './modules/sidebar-settings/sidebar-settings.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { throttlerConfig } from './config/throttler.config';

@Module({
  imports: [
    ThrottlerModule.forRoot(throttlerConfig),
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    StorageModule,
    QueueModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    SprintsModule,
    ActivityModule,
    NotificationsModule,
    FilesModule,
    SearchModule,
    TableSettingsModule,
    SidebarSettingsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // populates requestContext (IP + User-Agent) for every request, read
    // later by ActivityService.log() — see request-context.ts
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
