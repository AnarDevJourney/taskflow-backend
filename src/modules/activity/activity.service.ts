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
import { QueryWorkspaceActivityDto } from './dto/query-workspace-activity.dto';
import { getActivityModule } from './utils/activity-module.util';
import { requestContext } from '@common/context/request-context';
import { UAParser } from 'ua-parser-js';

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
      const { ip, userAgent } = requestContext.get();
      const ua = userAgent ? UAParser(userAgent) : null;

      await this.activityLogModel.create({
        taskId: this.toObjId(params.taskId),
        projectId: this.toObjId(params.projectId),
        workspaceId: this.toObjId(params.workspaceId),
        actorId: this.toObjId(params.actorId),
        action: params.action,
        module: getActivityModule(params.action), // derived once, at write time — see the schema field's NOTE
        field: params.field ?? null,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        meta: params.meta ?? null,
        ip,
        browser: this.formatBrowser(ua),
        os: this.formatOs(ua),
        device: this.formatDevice(ua),
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

  // ─── Get Workspace Activity (activity log page) ──────────────────
  async findByWorkspace(
    workspaceId: string,
    query: QueryWorkspaceActivityDto,
  ): Promise<PaginatedResult<ActivityLogDocument>> {
    const filter: Record<string, unknown> = {
      workspaceId: toObjectId(workspaceId),
    };

    if (query.userId) filter.actorId = toObjectId(query.userId);
    if (query.module) filter.module = query.module;
    if (query.action) filter.action = query.action;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (query.dateFrom) createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) createdAt.$lte = new Date(query.dateTo);
      filter.createdAt = createdAt;
    }

    const { skip, limit: take, page } = getPaginationParams({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 10,
    });

    const [items, total] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('actorId', 'name email avatarUrl')
        .populate('taskId', 'title')
        .populate('projectId', 'name'),
      this.activityLogModel.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, take) };
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  private toObjId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return toObjectId(id);
  }

  private formatBrowser(ua: ReturnType<typeof UAParser> | null): string | null {
    if (!ua?.browser.name) return null;
    return ua.browser.version ? `${ua.browser.name} ${ua.browser.version}` : ua.browser.name;
  }

  private formatOs(ua: ReturnType<typeof UAParser> | null): string | null {
    if (!ua?.os.name) return null;
    return ua.os.version ? `${ua.os.name} ${ua.os.version}` : ua.os.name;
  }

  private formatDevice(ua: ReturnType<typeof UAParser> | null): string | null {
    if (!ua) return null;
    // no device.type at all (common on desktop UAs) just means "desktop"
    if (!ua.device.type) return 'Desktop';
    const label = [ua.device.vendor, ua.device.model].filter(Boolean).join(' ');
    return label || ua.device.type;
  }
}
