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
import { ReorderBulkTasksDto } from './dto/reorder-bulk-tasks.dto';
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
    // task.assigneeId is populated by findOne() above (name/email/avatarUrl,
    // for the response), so it's a User document here, not a bare
    // ObjectId — `.toString()` on it would NOT give back the id (it falls
    // through to Object.prototype.toString → "[object Object]"), silently
    // breaking every `!== oldAssigneeId` comparison below. Read `._id` off
    // the populated doc first; fall back to `.toString()` for the
    // never-populated case (kept in case this method's populate ever
    // changes).
    const oldAssigneeId =
      (task.assigneeId as unknown as { _id?: Types.ObjectId })?._id?.toString() ??
      task.assigneeId?.toString() ??
      null;
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

    // dto.assigneeId can arrive unchanged — the frontend saves the whole
    // right panel in one batched request even if the user only edited one
    // field (see TaskDetailModal's Save/Cancel pattern) — so only log (and
    // notify) when the value actually moved, same as status/priority above
    if (
      dto.assigneeId !== undefined &&
      (dto.assigneeId ?? null) !== oldAssigneeId
    ) {
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

    // compare as timestamps, not raw strings — `dto.dueDate` and
    // `oldDueDate` can be equivalent instants in different string formats
    const newDueDateTime = dto.dueDate ? new Date(dto.dueDate).getTime() : null;
    const oldDueDateTime = oldDueDate ? new Date(oldDueDate).getTime() : null;
    if (dto.dueDate !== undefined && newDueDateTime !== oldDueDateTime) {
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

    if (
      dto.sprintId !== undefined &&
      (dto.sprintId ?? null) !== oldSprintId
    ) {
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
    const oldOrder = task.order;
    const newOrder = dto.order;

    if (oldStatus === newStatus) {
      // Same-column reorder — only shift the tasks strictly between the old
      // and new position, closing the gap the moved task leaves behind.
      if (newOrder > oldOrder) {
        // moving down: tasks between (oldOrder, newOrder] shift up by one
        await this.taskModel.updateMany(
          {
            projectId: task.projectId,
            status: newStatus,
            order: { $gt: oldOrder, $lte: newOrder },
            _id: { $ne: task._id },
            archivedAt: null,
          },
          { $inc: { order: -1 } },
        );
      } else if (newOrder < oldOrder) {
        // moving up: tasks between [newOrder, oldOrder) shift down by one
        await this.taskModel.updateMany(
          {
            projectId: task.projectId,
            status: newStatus,
            order: { $gte: newOrder, $lt: oldOrder },
            _id: { $ne: task._id },
            archivedAt: null,
          },
          { $inc: { order: 1 } },
        );
      }
    } else {
      // Cross-column move — close the gap left in the old column…
      await this.taskModel.updateMany(
        {
          projectId: task.projectId,
          status: oldStatus,
          order: { $gt: oldOrder },
          _id: { $ne: task._id },
          archivedAt: null,
        },
        { $inc: { order: -1 } },
      );
      // …and make room at the target position in the new column.
      await this.taskModel.updateMany(
        {
          projectId: task.projectId,
          status: newStatus,
          order: { $gte: newOrder },
          _id: { $ne: task._id },
          archivedAt: null,
        },
        { $inc: { order: 1 } },
      );
    }

    task.status = newStatus;
    task.order = newOrder;
    const saved = await task.save();

    // cross-column drag is a status change too — same as PATCHing `status`
    // via update(), just triggered by drag & drop instead of the modal
    if (oldStatus !== newStatus) {
      await this.activityService.log({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
        actorId: user._id,
        action: ActivityAction.STATUS_CHANGED,
        field: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
      });
    }

    return saved;
  }

  // ─── Reorder multiple tasks at once (multi-select drag & drop) ───
  async reorderBulk(
    workspaceId: string,
    projectId: string,
    dto: ReorderBulkTasksDto,
    user: UserDocument,
  ): Promise<{ updated: number }> {
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    this.assertValidStatus(project, dto.status);

    const movedIds = dto.taskIds.map((id) => toObjectId(id));

    const movedTasks = await this.taskModel.find({
      _id: { $in: movedIds },
      projectId: project._id,
      archivedAt: null,
    });

    if (movedTasks.length === 0) {
      throw new NotFoundException('No matching tasks found');
    }

    // Preserve the relative order the caller asked for (dto.taskIds), not
    // whatever order MongoDB happened to return them in.
    const movedById = new Map(
      movedTasks.map((t) => [(t._id as Types.ObjectId).toString(), t]),
    );
    const orderedMoved: TaskDocument[] = [];
    for (const id of dto.taskIds) {
      const found = movedById.get(id);
      if (found) orderedMoved.push(found);
    }
    const movedIdSet = new Set(
      orderedMoved.map((t) => (t._id as Types.ObjectId).toString()),
    );

    // Every column touched by this move: each moved task's original column,
    // plus the target column. Recomputing each one from scratch (rather than
    // incrementally shifting) keeps this correct regardless of how many
    // tasks move at once or where they came from.
    const affectedStatuses = new Set<string>([
      dto.status,
      ...orderedMoved.map((t) => t.status),
    ]);

    const bulkOps: Parameters<typeof this.taskModel.bulkWrite>[0] = [];

    for (const status of affectedStatuses) {
      const remaining = await this.taskModel
        .find({
          projectId: project._id,
          status,
          archivedAt: null,
          _id: { $nin: [...movedIdSet] },
        })
        .sort({ order: 1 })
        .select('_id');

      const finalOrder: Types.ObjectId[] =
        status === dto.status
          ? [
              ...remaining.slice(0, dto.order).map((t) => t._id as Types.ObjectId),
              ...orderedMoved.map((t) => t._id as Types.ObjectId),
              ...remaining.slice(dto.order).map((t) => t._id as Types.ObjectId),
            ]
          : remaining.map((t) => t._id as Types.ObjectId);

      finalOrder.forEach((id, index) => {
        const update: Record<string, unknown> = { order: index };
        if (status === dto.status) update.status = dto.status;
        bulkOps.push({
          updateOne: { filter: { _id: id }, update: { $set: update } },
        });
      });
    }

    if (bulkOps.length > 0) {
      await this.taskModel.bulkWrite(bulkOps);
    }

    // same status-change logging as the single-task reorder() and
    // update() — only for tasks that actually crossed columns
    for (const task of orderedMoved) {
      if (task.status === dto.status) continue;
      await this.activityService.log({
        taskId: task._id,
        projectId: project._id,
        workspaceId: project.workspaceId,
        actorId: user._id,
        action: ActivityAction.STATUS_CHANGED,
        field: 'status',
        oldValue: task.status,
        newValue: dto.status,
      });
    }

    return { updated: orderedMoved.length };
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
