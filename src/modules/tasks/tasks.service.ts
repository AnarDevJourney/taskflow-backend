import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { ProjectsService } from '@modules/projects/projects.service';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';
import { Priority } from './enums/priority.enum';
import { toObjectId } from '@common/utils/object-id';
import { ActivityService } from '@modules/activity/activity.service';
import { ActivityAction } from '@modules/activity/enums/activity-action.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { AppConfigService } from '@config/config.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private projectsService: ProjectsService,
    private workspacesService: WorkspacesService,
    private activityService: ActivityService,
    private notificationsService: NotificationsService,
    private config: AppConfigService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────
  async create(
    workspaceId: string,
    projectId: string,
    dto: CreateTaskDto,
    user: UserDocument,
  ): Promise<TaskDocument> {
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    // validate status exists in project
    this.assertValidStatus(project, dto.status);

    // get next task number atomically e.g. TF-1, TF-2
    const taskNumber =
      await this.projectsService.incrementTaskCounter(projectId);

    // new tasks go to the bottom of the column
    const lastTask = await this.taskModel
      .findOne({ projectId: project._id, status: dto.status, archivedAt: null })
      .sort({ order: -1 })
      .select('order');

    const order = lastTask ? lastTask.order + 1 : 0;

    const userId = user._id as Types.ObjectId;

    const task = await this.taskModel.create({
      projectId: project._id,
      workspaceId: toObjectId(workspaceId),
      taskNumber,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status,
      priority: dto.priority ?? Priority.MEDIUM,
      assigneeId: dto.assigneeId ? toObjectId(dto.assigneeId) : null,
      reporterId: userId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      labels: dto.labels ?? [],
      storyPoints: dto.storyPoints ?? null,
      sprintId: dto.sprintId ? toObjectId(dto.sprintId) : null,
      watchers: [userId], // creator auto-watches the task
      order,
    });

    await this.activityService.log({
      taskId: task._id,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      actorId: user._id,
      action: ActivityAction.TASK_CREATED,
      meta: task.title,
    });

    return task;
  }

  // ─── Find One ───────────────────────────────────────────────────
  async findOne(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: UserDocument,
  ): Promise<TaskDocument> {
    // findOne on project validates workspace membership
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    const task = await this.taskModel
      .findOne({
        _id: toObjectId(taskId),
        projectId: project._id,
        archivedAt: null,
      })
      .populate('assigneeId', 'name email avatarUrl')
      .populate('reporterId', 'name email avatarUrl')
      .populate('watchers', 'name email avatarUrl');

    if (!task) throw new NotFoundException('Task not found');

    return task;
  }

  // ─── Update ─────────────────────────────────────────────────────
  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    dto: UpdateTaskDto,
    user: UserDocument,
  ): Promise<TaskDocument> {
    const task = await this.findOne(workspaceId, projectId, taskId, user);
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    // validate new status if provided
    if (dto.status) {
      this.assertValidStatus(project, dto.status);
    }

    // capture old values before mutation
    const oldStatus = task.status;
    const oldPriority = task.priority;
    const oldAssigneeId = task.assigneeId?.toString() ?? null;
    const oldDueDate = task.dueDate?.toISOString() ?? null;
    const oldSprintId = task.sprintId?.toString() ?? null;

    // convert string IDs to ObjectIds where needed
    const updateData: any = { ...dto };

    if (dto.assigneeId !== undefined) {
      updateData.assigneeId = dto.assigneeId
        ? toObjectId(dto.assigneeId)
        : null;
    }

    if (dto.sprintId !== undefined) {
      updateData.sprintId = dto.sprintId ? toObjectId(dto.sprintId) : null;
    }

    if (dto.dueDate !== undefined) {
      updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    Object.assign(task, updateData);
    const saved = await task.save();

    if (dto.status && dto.status !== oldStatus) {
      await this.activityService.log({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        actorId: user._id,
        action: ActivityAction.STATUS_CHANGED,
        field: 'status',
        oldValue: oldStatus,
        newValue: dto.status,
      });
    }

    if (dto.priority && dto.priority !== oldPriority) {
      await this.activityService.log({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        actorId: user._id,
        action: ActivityAction.PRIORITY_CHANGED,
        field: 'priority',
        oldValue: oldPriority,
        newValue: dto.priority,
      });
    }

    if (dto.assigneeId !== undefined) {
      await this.activityService.log({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        actorId: user._id,
        action: ActivityAction.ASSIGNEE_CHANGED,
        field: 'assigneeId',
        oldValue: oldAssigneeId,
        newValue: dto.assigneeId ?? null,
      });

      const actorId = (user._id as Types.ObjectId).toString();
      if (dto.assigneeId && dto.assigneeId !== actorId) {
        const taskKey = `${project.key}-${task.taskNumber}`;
        const taskUrl = `${this.config.appUrl}/w/${workspaceId}/p/${projectId}/tasks/${taskId}`;
        await this.notificationsService.notifyTaskAssigned({
          recipientId: dto.assigneeId,
          actorId,
          actorName: user.name,
          taskId: (task._id as Types.ObjectId).toString(),
          taskKey,
          taskTitle: task.title,
          projectId: task.projectId.toString(),
          projectName: project.name,
          workspaceId: task.workspaceId.toString(),
          taskUrl,
        });
      }
    }

    if (dto.dueDate !== undefined) {
      await this.activityService.log({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        actorId: user._id,
        action: ActivityAction.DUE_DATE_CHANGED,
        field: 'dueDate',
        oldValue: oldDueDate,
        newValue: dto.dueDate ?? null,
      });
    }

    if (dto.sprintId !== undefined) {
      await this.activityService.log({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        actorId: user._id,
        action: dto.sprintId
          ? ActivityAction.ADDED_TO_SPRINT
          : ActivityAction.REMOVED_FROM_SPRINT,
        oldValue: oldSprintId,
        newValue: dto.sprintId ?? null,
      });
    }

    return saved;
  }

  // ─── Reorder (drag & drop) ───────────────────────────────────────
  async reorder(
    workspaceId: string,
    projectId: string,
    taskId: string,
    dto: ReorderTaskDto,
    user: UserDocument,
  ): Promise<TaskDocument> {
    const task = await this.findOne(workspaceId, projectId, taskId, user);
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    if (dto.status) {
      this.assertValidStatus(project, dto.status);
    }

    const oldStatus = task.status;
    const newStatus = dto.status ?? oldStatus;

    // shift other tasks to make room at the new position
    await this.taskModel.updateMany(
      {
        projectId: task.projectId,
        status: newStatus,
        order: { $gte: dto.order },
        _id: { $ne: task._id },
        archivedAt: null,
      },
      { $inc: { order: 1 } },
    );

    task.status = newStatus;
    task.order = dto.order;
    return task.save();
  }

  // ─── Delete (soft) ───────────────────────────────────────────────
  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: UserDocument,
  ): Promise<void> {
    const task = await this.findOne(workspaceId, projectId, taskId, user);
    const workspace = await this.workspacesService.findOne(workspaceId, user);

    const userId = (user._id as Types.ObjectId).toString();
    const isReporter = task.reporterId.toString() === userId;

    // only reporter, admin, or owner can delete
    const workspaceRole = this.workspacesService.getMemberRole(workspace, user);
    const canDelete =
      isReporter ||
      workspaceRole === WorkspaceRole.OWNER ||
      workspaceRole === WorkspaceRole.ADMIN;

    if (!canDelete) {
      throw new ForbiddenException(
        'Only the task reporter or an admin can delete tasks',
      );
    }

    await this.taskModel.findByIdAndUpdate(task._id, {
      archivedAt: new Date(),
    });

    await this.activityService.log({
      taskId: task._id,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      actorId: user._id,
      action: ActivityAction.TASK_DELETED,
      meta: task.title,
    });
  }

  // ─── Bulk Update ─────────────────────────────────────────────────
  async bulkUpdate(
    workspaceId: string,
    projectId: string,
    dto: BulkUpdateTasksDto,
    user: UserDocument,
  ): Promise<{ updated: number }> {
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    if (dto.status) {
      this.assertValidStatus(project, dto.status);
    }

    const taskObjectIds = dto.taskIds.map((id) => toObjectId(id));

    const updateData: any = {};
    if (dto.status) updateData.status = dto.status;
    if (dto.priority) updateData.priority = dto.priority;
    if (dto.assigneeId) updateData.assigneeId = toObjectId(dto.assigneeId);
    if (dto.labels) updateData.labels = dto.labels;

    const result = await this.taskModel.updateMany(
      {
        _id: { $in: taskObjectIds },
        projectId: project._id,
        archivedAt: null,
      },
      { $set: updateData },
    );

    return { updated: result.modifiedCount };
  }

  // ─── Watchers ────────────────────────────────────────────────────
  async addWatcher(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: UserDocument,
  ): Promise<void> {
    const task = await this.findOne(workspaceId, projectId, taskId, user);
    const userId = user._id as Types.ObjectId;

    const alreadyWatching = task.watchers.some(
      (w) => w.toString() === userId.toString(),
    );

    if (!alreadyWatching) {
      await this.taskModel.findByIdAndUpdate(task._id, {
        $push: { watchers: userId },
      });

      await this.activityService.log({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        actorId: user._id,
        action: ActivityAction.WATCHER_ADDED,
        newValue: userId.toString(),
      });
    }
  }

  async removeWatcher(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: UserDocument,
  ): Promise<void> {
    const task = await this.findOne(workspaceId, projectId, taskId, user);
    const userId = user._id as Types.ObjectId;

    await this.taskModel.findByIdAndUpdate(task._id, {
      $pull: { watchers: userId },
    });

    await this.activityService.log({
      taskId: task._id,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      actorId: user._id,
      action: ActivityAction.WATCHER_REMOVED,
      oldValue: userId.toString(),
    });
  }

  // ─── Checklist ───────────────────────────────────────────────────
  async addChecklistItem(
    workspaceId: string,
    projectId: string,
    taskId: string,
    title: string,
    user: UserDocument,
  ): Promise<TaskDocument> {
    const task = await this.findOne(workspaceId, projectId, taskId, user);

    task.checklist.push({ title, completed: false, createdAt: new Date() });
    const saved = await task.save();

    await this.activityService.log({
      taskId: task._id,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      actorId: user._id,
      action: ActivityAction.CHECKLIST_ITEM_ADDED,
      meta: title,
    });

    return saved;
  }

  async toggleChecklistItem(
    workspaceId: string,
    projectId: string,
    taskId: string,
    itemIndex: number,
    user: UserDocument,
  ): Promise<TaskDocument> {
    const task = await this.findOne(workspaceId, projectId, taskId, user);

    if (!task.checklist[itemIndex]) {
      throw new BadRequestException('Checklist item not found');
    }

    task.checklist[itemIndex].completed = !task.checklist[itemIndex].completed;
    const isNowCompleted = task.checklist[itemIndex].completed;

    task.markModified('checklist');

    const saved = await task.save();

    await this.activityService.log({
      taskId: task._id,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      actorId: user._id,
      action: isNowCompleted
        ? ActivityAction.CHECKLIST_ITEM_COMPLETED
        : ActivityAction.CHECKLIST_ITEM_REOPENED,
      meta: task.checklist[itemIndex].title,
    });

    return saved;
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  private assertValidStatus(project: any, status: string): void {
    const validStatuses = project.statuses.map((s: any) => s.name);
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status "${status}". Valid statuses: ${validStatuses.join(', ')}`,
      );
    }
  }
}
