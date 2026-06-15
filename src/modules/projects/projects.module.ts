import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project, ProjectSchema } from './schemas/project.schema';
import { WorkspacesModule } from '@modules/workspaces/workspaces.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
    WorkspacesModule, // needed for WorkspacesService.findOne / assertRole
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService], // tasks module will need findOne + incrementTaskCounter
})
export class ProjectsModule {}
