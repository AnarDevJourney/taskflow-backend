import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { AuthService } from '@modules/auth/auth.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { WorkspaceRole } from './enums/workspace-role.enum';
import { toObjectId } from '@common/utils/object-id';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name)
    private workspaceModel: Model<WorkspaceDocument>,
    private authService: AuthService,
  ) {}

  // ─── Create Workspace ───────────────────────────────────────────
  async create(
    dto: CreateWorkspaceDto,
    user: UserDocument,
  ): Promise<WorkspaceDocument> {
    const userId = user._id as Types.ObjectId;

    const slugTaken = await this.workspaceModel.findOne({ slug: dto.slug });
    if (slugTaken) {
      throw new ConflictException('This slug is already taken');
    }

    const workspace = await this.workspaceModel.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      ownerId: userId,
      members: [
        {
          userId,
          role: WorkspaceRole.OWNER,
          joinedAt: new Date(),
        },
      ],
    });

    return workspace;
  }

  // ─── Get My Workspaces ──────────────────────────────────────────
  async findMyWorkspaces(user: UserDocument): Promise<WorkspaceDocument[]> {
    const userId = user._id as Types.ObjectId;

    return this.workspaceModel
      .find({
        'members.userId': userId,
        archivedAt: null,
      })
      .sort({ createdAt: -1 });
  }

  // ─── Get Archived Workspaces ─────────────────────────────────────
  async findArchivedWorkspaces(user: UserDocument): Promise<WorkspaceDocument[]> {
    const userId = user._id as Types.ObjectId;

    return this.workspaceModel
      .find({
        ownerId: userId,
        archivedAt: { $ne: null },
      })
      .sort({ archivedAt: -1 });
  }

  // ─── Get One ────────────────────────────────────────────────────
  async findOne(
    workspaceId: string,
    user: UserDocument,
  ): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceModel.findById(
      toObjectId(workspaceId),
    );

    if (!workspace || workspace.archivedAt) {
      throw new NotFoundException('Workspace not found');
    }

    this.assertMember(workspace, user);

    return workspace;
  }

  // ─── Update ─────────────────────────────────────────────────────
  async update(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
    user: UserDocument,
  ): Promise<WorkspaceDocument> {
    const workspace = await this.findOne(workspaceId, user);

    this.assertRole(workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    Object.assign(workspace, dto);
    return workspace.save();
  }

  // ─── Archive Workspace ──────────────────────────────────────────
  async archive(workspaceId: string, user: UserDocument): Promise<void> {
    const workspace = await this.findOne(workspaceId, user);

    this.assertRole(workspace, user, [WorkspaceRole.OWNER]);

    await this.workspaceModel.findByIdAndUpdate(workspace._id, {
      archivedAt: new Date(),
    });
  }

  // ─── Restore Workspace ───────────────────────────────────────────
  async restore(workspaceId: string, user: UserDocument): Promise<void> {
    const workspace = await this.workspaceModel.findById(
      toObjectId(workspaceId),
    );

    if (!workspace || !workspace.archivedAt) {
      throw new NotFoundException('Archived workspace not found');
    }

    if (workspace.ownerId.toString() !== (user._id as Types.ObjectId).toString()) {
      throw new ForbiddenException('Only the owner can restore this workspace');
    }

    await this.workspaceModel.findByIdAndUpdate(workspace._id, {
      archivedAt: null,
    });
  }

  // ─── Get Members ────────────────────────────────────────────────
  async getMembers(workspaceId: string, user: UserDocument) {
    const workspace = await this.findOne(workspaceId, user);

    // populate userId with name and email from users collection
    await workspace.populate('members.userId', 'name email avatarUrl');

    return workspace.members;
  }

  // ─── Invite Member ──────────────────────────────────────────────
  async inviteMember(
    workspaceId: string,
    dto: InviteMemberDto,
    user: UserDocument,
  ) {
    const workspace = await this.findOne(workspaceId, user);

    this.assertRole(workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    const token = await this.authService.createInvite(
      dto.email,
      dto.role,
      workspaceId,
      (user._id as Types.ObjectId).toString(),
      user.name,
      workspace.name,
    );

    return { message: `Invite sent to ${dto.email}`, token };
  }

  // ─── Update Member Role ─────────────────────────────────────────
  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    user: UserDocument,
  ) {
    const workspace = await this.findOne(workspaceId, user);

    this.assertRole(workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    // owner role can only be changed by owner
    if (dto.role === WorkspaceRole.OWNER) {
      this.assertRole(workspace, user, [WorkspaceRole.OWNER]);
    }

    const memberObjectId = toObjectId(memberId);
    const member = workspace.members.find(
      (m) => m.userId.toString() === memberObjectId.toString(),
    );

    if (!member) {
      throw new NotFoundException('Member not found in this workspace');
    }

    // prevent changing own role
    if (member.userId.toString() === (user._id as Types.ObjectId).toString()) {
      throw new BadRequestException('You cannot change your own role');
    }

    member.role = dto.role;
    await workspace.save();

    return { message: 'Member role updated' };
  }

  // ─── Remove Member ──────────────────────────────────────────────
  async removeMember(
    workspaceId: string,
    memberId: string,
    user: UserDocument,
  ) {
    const workspace = await this.findOne(workspaceId, user);

    this.assertRole(workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    const memberObjectId = toObjectId(memberId);

    // prevent removing owner
    const targetMember = workspace.members.find(
      (m) => m.userId.toString() === memberObjectId.toString(),
    );

    if (!targetMember) {
      throw new NotFoundException('Member not found in this workspace');
    }

    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    // prevent removing yourself
    if (memberObjectId.toString() === (user._id as Types.ObjectId).toString()) {
      throw new BadRequestException(
        'You cannot remove yourself — use leave workspace instead',
      );
    }

    workspace.members = workspace.members.filter(
      (m) => m.userId.toString() !== memberObjectId.toString(),
    );

    await workspace.save();

    return { message: 'Member removed' };
  }

  // ─── Leave Workspace ────────────────────────────────────────────
  async leave(workspaceId: string, user: UserDocument) {
    const workspace = await this.findOne(workspaceId, user);
    const userId = (user._id as Types.ObjectId).toString();

    const member = workspace.members.find(
      (m) => m.userId.toString() === userId,
    );

    if (member?.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        'Owner cannot leave — transfer ownership first',
      );
    }

    workspace.members = workspace.members.filter(
      (m) => m.userId.toString() !== userId,
    );

    await workspace.save();

    return { message: 'You have left the workspace' };
  }

  // ─── Guard Helpers ──────────────────────────────────────────────
  getMemberRole(
    workspace: WorkspaceDocument,
    user: UserDocument,
  ): WorkspaceRole | null {
    const userId = (user._id as Types.ObjectId).toString();
    const member = workspace.members.find(
      (m) => m.userId.toString() === userId,
    );
    return member?.role ?? null;
  }

  assertMember(workspace: WorkspaceDocument, user: UserDocument): void {
    const role = this.getMemberRole(workspace, user);
    if (!role) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
  }

  assertRole(
    workspace: WorkspaceDocument,
    user: UserDocument,
    allowedRoles: WorkspaceRole[],
  ): void {
    const role = this.getMemberRole(workspace, user);
    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Required role: ${allowedRoles.join(' or ')}`,
      );
    }
  }
}
