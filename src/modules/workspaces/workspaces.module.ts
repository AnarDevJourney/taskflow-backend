import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { Workspace, WorkspaceSchema } from './schemas/workspace.schema';
import { AuthModule } from '@modules/auth/auth.module';
import { WorkspaceLogoResolver } from './resolvers/workspace-logo.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    AuthModule, // needed for AuthService.createInvite()
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceLogoResolver],
  exports: [WorkspacesService], // projects module will need assertMember/assertRole
})
export class WorkspacesModule {}
