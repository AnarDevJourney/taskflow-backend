import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';
import { SprintsReportService } from './sprints-report.service';
import { Sprint, SprintSchema } from './schemas/sprint.schema';
import { Task, TaskSchema } from '@modules/tasks/schemas/task.schema';
import { ProjectsModule } from '@modules/projects/projects.module';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sprint.name, schema: SprintSchema },
      { name: Task.name, schema: TaskSchema }, // SprintsService updates tasks directly
    ]),
    ProjectsModule,
    WorkspacesModule,
  ],
  controllers: [SprintsController],
  providers: [SprintsService, SprintsReportService],
  exports: [SprintsService],
})
export class SprintsModule {}
