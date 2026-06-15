import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { TasksModule } from '@modules/tasks/tasks.module';
import { ActivityModule } from '@modules/activity/activity.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ProjectsModule } from '@modules/projects/projects.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]),
    TasksModule, // CommentsService needs TasksService.findOne for membership check
    ActivityModule,
    NotificationsModule,
    ProjectsModule, // CommentsService needs ProjectsService for project key/name in notifications
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService], // ActivityModule will need this later
})
export class CommentsModule {}
