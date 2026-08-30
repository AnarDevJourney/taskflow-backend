import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Task, TaskSchema } from '@modules/tasks/schemas/task.schema';
import {
  Project,
  ProjectSchema,
} from '@modules/projects/schemas/project.schema';
import { User, UserSchema } from '@modules/users/schemas/user.schema';
import {
  Workspace,
  WorkspaceSchema,
} from '@modules/workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';
import { ProjectsModule } from '@modules/projects/projects.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    // Task/Project/User/Workspace schemas are registered directly (search
    // needs raw model access for cross-collection queries, not those
    // modules' services). WorkspacesModule and ProjectsModule are real
    // imports because membership checking is genuinely
    // WorkspacesService.findOne() / ProjectsService.findOne()'s job — same
    // reasoning as DashboardModule.
    WorkspacesModule,
    ProjectsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
