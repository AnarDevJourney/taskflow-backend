import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from '@modules/tasks/schemas/task.schema';
import { ProjectsModule } from '@modules/projects/projects.module';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';
import { ActivityModule } from '@modules/activity/activity.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { TaskAttachmentResolver } from './resolvers/task-attachment.resolver';

// No MulterModule registration here on purpose — StreamingFileInterceptor
// builds its own multer instance around the MinIO storage engine, so there is
// no global storage setting that could silently fall back to buffering.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    ProjectsModule, // project/workspace permission checks
    WorkspacesModule, // role check on delete
    ActivityModule, // attachment_added / attachment_removed audit entries
  ],
  controllers: [FilesController],
  providers: [FilesService, TaskAttachmentResolver],
  exports: [FilesService],
})
export class FilesModule {}
