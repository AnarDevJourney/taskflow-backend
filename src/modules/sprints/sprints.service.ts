import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sprint, SprintDocument, SprintStatus } from './schemas/sprint.schema';
import { Task, TaskDocument } from '@modules/tasks/schemas/task.schema';
import { ProjectsService } from '@modules/projects/projects.service';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import {
  CompleteSprintDto,
  IncompleteTaskAction,
} from './dto/complete-sprint.dto';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';
import { toObjectId } from '@common/utils/object-id';

@Injectable()
export class SprintsService {
  constructor(
    @InjectModel(Sprint.name) private sprintModel: Model<SprintDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private projectsService: ProjectsService,
    private workspacesService: WorkspacesService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────
  async create(
    workspaceId: string,
    projectId: string,
    dto: CreateSprintDto,
    user: UserDocument,
  ): Promise<SprintDocument> {
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    this.workspacesService.assertRole(workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);

    if (!project.sprintMode) {
      throw new BadRequestException(
        'Sprint mode is not enabled for this project — enable it in project settings first',
      );
    }

    this.assertDateRange(dto.startDate, dto.endDate);

    return this.sprintModel.create({
      projectId: project._id,
      workspaceId: toObjectId(workspaceId),
      name: dto.name,
      goal: dto.goal ?? null,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }

  // ─── Find All ───────────────────────────────────────────────────
  async findAll(
    workspaceId: string,
    projectId: string,
    user: UserDocument,
  ): Promise<SprintDocument[]> {
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    return this.sprintModel
      .find({ projectId: project._id })
      .sort({ startDate: -1 });
  }

  // ─── Find One ───────────────────────────────────────────────────
  async findOne(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    user: UserDocument,
  ): Promise<SprintDocument> {
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    const sprint = await this.sprintModel.findOne({
      _id: toObjectId(sprintId),
      projectId: project._id,
    });

    if (!sprint) throw new NotFoundException('Sprint not found');

    return sprint;
  }

  // ─── Update ─────────────────────────────────────────────────────
  async update(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    dto: UpdateSprintDto,
    user: UserDocument,
  ): Promise<SprintDocument> {
    const sprint = await this.findOne(workspaceId, projectId, sprintId, user);

    if (sprint.status === SprintStatus.COMPLETED) {
      throw new BadRequestException('Cannot edit a completed sprint');
    }

    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate ?? sprint.startDate.toISOString();
      const endDate = dto.endDate ?? sprint.endDate.toISOString();
      this.assertDateRange(startDate, endDate);
    }

    Object.assign(sprint, {
      ...(dto.name && { name: dto.name }),
      ...(dto.goal !== undefined && { goal: dto.goal }),
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
    });

    return sprint.save();
  }

  // ─── Start Sprint ────────────────────────────────────────────────
  async start(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    user: UserDocument,
  ): Promise<SprintDocument> {
    const sprint = await this.findOne(workspaceId, projectId, sprintId, user);

    if (sprint.status !== SprintStatus.PLANNED) {
      throw new BadRequestException(`Sprint is already ${sprint.status}`);
    }

    // only one active sprint per project at a time
    const activeSprint = await this.sprintModel.findOne({
      projectId: sprint.projectId,
      status: SprintStatus.ACTIVE,
    });

    if (activeSprint) {
      throw new BadRequestException(
        'Another sprint is already active in this project — complete it first',
      );
    }

    sprint.status = SprintStatus.ACTIVE;
    return sprint.save();
  }

  // ─── Complete Sprint ─────────────────────────────────────────────
  async complete(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    dto: CompleteSprintDto,
    user: UserDocument,
  ): Promise<SprintDocument> {
    const sprint = await this.findOne(workspaceId, projectId, sprintId, user);

    if (sprint.status !== SprintStatus.ACTIVE) {
      throw new BadRequestException('Only an active sprint can be completed');
    }

    if (
      dto.incompleteTaskAction === IncompleteTaskAction.MOVE_TO_NEXT_SPRINT &&
      !dto.nextSprintId
    ) {
      throw new BadRequestException(
        'nextSprintId is required when moving tasks to next sprint',
      );
    }

    // get all tasks in this sprint
    const sprintTasks = await this.taskModel.find({
      sprintId: sprint._id,
      archivedAt: null,
    });

    // figure out which status is "done" — last status in project config
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    const doneStatus = project.statuses[project.statuses.length - 1].name;

    const completedTasks = sprintTasks.filter((t) => t.status === doneStatus);
    const incompleteTasks = sprintTasks.filter((t) => t.status !== doneStatus);

    // calculate velocity snapshot
    const totalPoints = sprintTasks.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    );
    const completedPoints = completedTasks.reduce(
      (sum, t) => sum + (t.storyPoints ?? 0),
      0,
    );

    // handle incomplete tasks
    if (incompleteTasks.length > 0) {
      const incompleteIds = incompleteTasks.map((t) => t._id);

      if (dto.incompleteTaskAction === IncompleteTaskAction.MOVE_TO_BACKLOG) {
        // remove sprint assignment — task goes back to backlog
        await this.taskModel.updateMany(
          { _id: { $in: incompleteIds } },
          { $set: { sprintId: null } },
        );
      } else {
        // move to next sprint
        const nextSprintId = toObjectId(dto.nextSprintId!);
        await this.taskModel.updateMany(
          { _id: { $in: incompleteIds } },
          { $set: { sprintId: nextSprintId } },
        );
      }
    }

    // finalize sprint
    sprint.status = SprintStatus.COMPLETED;
    sprint.completedAt = new Date();
    sprint.totalPoints = totalPoints;
    sprint.completedPoints = completedPoints;

    return sprint.save();
  }

  // ─── Delete ──────────────────────────────────────────────────────
  async remove(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    user: UserDocument,
  ): Promise<void> {
    const sprint = await this.findOne(workspaceId, projectId, sprintId, user);

    if (sprint.status === SprintStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot delete an active sprint — complete it first',
      );
    }

    // move tasks back to backlog
    await this.taskModel.updateMany(
      { sprintId: sprint._id },
      { $set: { sprintId: null } },
    );

    await this.sprintModel.findByIdAndDelete(sprint._id);
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  private assertDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }
  }
}
