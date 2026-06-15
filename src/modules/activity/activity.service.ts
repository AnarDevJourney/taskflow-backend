import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActivityLog,
  ActivityLogDocument,
} from './schemas/activity-log.schema';
import { ActivityAction } from './enums/activity-action.enum';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '@common/utils/pagination';
import { toObjectId } from '@common/utils/object-id';

export interface LogActivityParams {
  taskId: string | Types.ObjectId;
  projectId: string | Types.ObjectId;
  workspaceId: string | Types.ObjectId;
  actorId: string | Types.ObjectId;
  action: ActivityAction;
  field?: string;
  oldValue?: any;
  newValue?: any;
  meta?: string;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
  ) {}

  // ─── Log (called by other services) ─────────────────────────────
  // fire-and-forget — never throws, never blocks the caller
  async log(params: LogActivityParams): Promise<void> {
    try {
      await this.activityLogModel.create({
        taskId: this.toObjId(params.taskId),
        projectId: this.toObjId(params.projectId),
        workspaceId: this.toObjId(params.workspaceId),
        actorId: this.toObjId(params.actorId),
        action: params.action,
        field: params.field ?? null,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        meta: params.meta ?? null,
      });
    } catch (err) {
      // never let activity logging break the main operation
      console.error('[ActivityService] Failed to log activity:', err);
    }
  }

  // ─── Get Task Activity ───────────────────────────────────────────
  async findByTask(
    taskId: string,
    page = 1,
    limit = 30,
  ): Promise<PaginatedResult<ActivityLogDocument>> {
    const filter = { taskId: toObjectId(taskId) };
    const { skip, limit: take } = getPaginationParams({ page, limit });

    const [items, total] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('actorId', 'name email avatarUrl'),
      this.activityLogModel.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, take) };
  }

  // ─── Get Project Activity ────────────────────────────────────────
  async findByProject(
    projectId: string,
    page = 1,
    limit = 30,
  ): Promise<PaginatedResult<ActivityLogDocument>> {
    const filter = { projectId: toObjectId(projectId) };
    const { skip, limit: take } = getPaginationParams({ page, limit });

    const [items, total] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('actorId', 'name email avatarUrl'),
      this.activityLogModel.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, take) };
  }

  // ─── Helper ──────────────────────────────────────────────────────
  private toObjId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return toObjectId(id);
  }
}
