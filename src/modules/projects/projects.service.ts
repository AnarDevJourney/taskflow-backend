import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateStatusConfigDto } from './dto/update-status-config.dto';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';
import { toObjectId } from '@common/utils/object-id';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name)
    private projectModel: Model<ProjectDocument>,
    private workspacesService: WorkspacesService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────
  async create(
    workspaceId: string,
    dto: CreateProjectDto,
    user: UserDocument,
  ): Promise<ProjectDocument> {
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    this.workspacesService.assertRole(workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    // key must be unique within a workspace
    const keyTaken = await this.projectModel.findOne({
      workspaceId: workspace._id,
      key: dto.key.toUpperCase(),
      archivedAt: null,
    });

    if (keyTaken) {
      throw new ConflictException(
        `Project key "${dto.key.toUpperCase()}" is already used in this workspace`,
      );
    }

    const userId = user._id as Types.ObjectId;

    const project = await this.projectModel.create({
      workspaceId: workspace._id,
      name: dto.name,
      key: dto.key.toUpperCase(),
      description: dto.description,
      ownerId: userId,
      sprintMode: dto.sprintMode ?? false,
      color: dto.color ?? '#3B82F6',
      icon: dto.icon,
      members: [
        {
          userId,
          role: WorkspaceRole.OWNER,
          joinedAt: new Date(),
        },
      ],
    });

    return project;
  }

  // ─── Find All in Workspace ──────────────────────────────────────
  async findAll(
    workspaceId: string,
    user: UserDocument,
  ): Promise<ProjectDocument[]> {
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    return this.projectModel
      .find({
        workspaceId: workspace._id,
        archivedAt: null,
      })
      .select('-members -statuses')
      .sort({ createdAt: -1 });
  }

  // ─── Find One ───────────────────────────────────────────────────
  async findOne(
    workspaceId: string,
    projectId: string,
    user: UserDocument,
  ): Promise<ProjectDocument> {
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    const project = await this.projectModel.findOne({
      _id: toObjectId(projectId),
      workspaceId: workspace._id,
      archivedAt: null,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.assertProjectMemberOrWorkspaceAdmin(project, workspace, user);

    return project;
  }

  // ─── Update ─────────────────────────────────────────────────────
  async update(
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
    user: UserDocument,
  ): Promise<ProjectDocument> {
    const project = await this.findOne(workspaceId, projectId, user);
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    this.assertProjectRole(project, workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    Object.assign(project, dto);
    return project.save();
  }

  // ─── Update Status Config ───────────────────────────────────────
  async updateStatuses(
    workspaceId: string,
    projectId: string,
    dto: UpdateStatusConfigDto,
    user: UserDocument,
  ): Promise<ProjectDocument> {
    const project = await this.findOne(workspaceId, projectId, user);
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    this.assertProjectRole(project, workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    project.statuses = dto.statuses;
    return project.save();
  }

  // ─── Archive ────────────────────────────────────────────────────
  async archive(
    workspaceId: string,
    projectId: string,
    user: UserDocument,
  ): Promise<void> {
    const project = await this.findOne(workspaceId, projectId, user);
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    this.assertProjectRole(project, workspace, user, [WorkspaceRole.OWNER]);

    await this.projectModel.findByIdAndUpdate(project._id, {
      archivedAt: new Date(),
    });
  }

  // ─── Get Archived Projects ───────────────────────────────────────
  async findArchivedProjects(
    workspaceId: string,
    user: UserDocument,
  ): Promise<ProjectDocument[]> {
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    return this.projectModel
      .find({
        workspaceId: workspace._id,
        archivedAt: { $ne: null },
      })
      .select('-members -statuses')
      .sort({ archivedAt: -1 });
  }

  // ─── Restore ────────────────────────────────────────────────────
  async restore(
    workspaceId: string,
    projectId: string,
    user: UserDocument,
  ): Promise<void> {
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    const project = await this.projectModel.findOne({
      _id: toObjectId(projectId),
      workspaceId: workspace._id,
    });

    if (!project || !project.archivedAt) {
      throw new NotFoundException('Archived project not found');
    }

    this.assertProjectRole(project, workspace, user, [WorkspaceRole.OWNER]);

    await this.projectModel.findByIdAndUpdate(project._id, {
      archivedAt: null,
    });
  }

  // ─── Get Members ────────────────────────────────────────────────
  async getMembers(workspaceId: string, projectId: string, user: UserDocument) {
    const project = await this.findOne(workspaceId, projectId, user);
    await project.populate('members.userId', 'name email avatarUrl');
    return project.members;
  }

  // ─── Add Member ─────────────────────────────────────────────────
  async addMember(
    workspaceId: string,
    projectId: string,
    memberId: string,
    role: WorkspaceRole,
    user: UserDocument,
  ) {
    const project = await this.findOne(workspaceId, projectId, user);
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    this.assertProjectRole(project, workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    // must be a workspace member first
    this.workspacesService.assertMember(workspace, {
      _id: toObjectId(memberId),
    } as any);

    const alreadyMember = project.members.find(
      (m) => m.userId.toString() === memberId,
    );

    if (alreadyMember) {
      throw new ConflictException('User is already a member of this project');
    }

    project.members.push({
      userId: toObjectId(memberId),
      role,
      joinedAt: new Date(),
    });

    await project.save();

    return { message: 'Member added to project' };
  }

  // ─── Remove Member ──────────────────────────────────────────────
  async removeMember(
    workspaceId: string,
    projectId: string,
    memberId: string,
    user: UserDocument,
  ) {
    const project = await this.findOne(workspaceId, projectId, user);
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    this.assertProjectRole(project, workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    const memberObjectId = toObjectId(memberId);
    const target = project.members.find(
      (m) => m.userId.toString() === memberObjectId.toString(),
    );

    if (!target) {
      throw new NotFoundException('Member not found in this project');
    }

    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot remove the project owner');
    }

    project.members = project.members.filter(
      (m) => m.userId.toString() !== memberObjectId.toString(),
    );

    await project.save();

    return { message: 'Member removed from project' };
  }

  // ─── Increment Task Counter ─────────────────────────────────────
  // called by TasksService when creating a new task
  async incrementTaskCounter(projectId: string): Promise<number> {
    const project = await this.projectModel.findByIdAndUpdate(
      toObjectId(projectId),
      { $inc: { taskCounter: 1 } },
      { new: true },
    );

    if (!project) throw new NotFoundException('Project not found');

    return project.taskCounter;
  }

  // ─── Role Helpers ───────────────────────────────────────────────
  private assertProjectMemberOrWorkspaceAdmin(
    project: ProjectDocument,
    workspace: any,
    user: UserDocument,
  ): void {
    const workspaceRole = this.workspacesService.getMemberRole(workspace, user);

    // workspace owner/admin can always access all projects
    if (
      workspaceRole === WorkspaceRole.OWNER ||
      workspaceRole === WorkspaceRole.ADMIN
    ) {
      return;
    }

    // otherwise must be a project member
    const userId = (user._id as Types.ObjectId).toString();
    const isMember = project.members.some(
      (m) => m.userId.toString() === userId,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this project');
    }
  }

  private assertProjectRole(
    project: ProjectDocument,
    workspace: any,
    user: UserDocument,
    allowedRoles: WorkspaceRole[],
  ): void {
    const workspaceRole = this.workspacesService.getMemberRole(workspace, user);

    // workspace owner always has full access
    if (workspaceRole === WorkspaceRole.OWNER) return;

    const userId = (user._id as Types.ObjectId).toString();
    const member = project.members.find((m) => m.userId.toString() === userId);

    if (!member || !allowedRoles.includes(member.role)) {
      throw new ForbiddenException(
        `Required role: ${allowedRoles.join(' or ')}`,
      );
    }
  }
}
