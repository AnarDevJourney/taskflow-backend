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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    // no feature module deps — registers schemas directly
    // to avoid circular dependency chains
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
