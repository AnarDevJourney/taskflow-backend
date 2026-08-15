import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { QueryMyTasksDto } from './dto/query-my-tasks.dto';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '@common/utils/pagination';
import { toObjectId } from '@common/utils/object-id';

// escape regex special characters so a free-typed status filter can't be
// interpreted as a regex pattern
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class TasksQueryService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

  async findAll(
    projectId: string,
    query: QueryTasksDto,
  ): Promise<PaginatedResult<TaskDocument>> {
    const filter = this.buildFilter(projectId, query);
    const sort = this.buildSort(query);
    const { skip, limit, page } = getPaginationParams(query);

    const [items, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('assigneeId', 'name email avatarUrl')
        .populate('reporterId', 'name email avatarUrl'),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  // ─── Cross-project "my tasks" listing ────────────────────────────
  // Unlike findAll (scoped to one project), this queries by the schema's
  // `workspaceId` + `assigneeId` compound index directly, so it stays a
  // single indexed query across every project in the workspace.
  async findMyTasks(
    workspaceId: string,
    userId: string,
    query: QueryMyTasksDto,
  ): Promise<PaginatedResult<TaskDocument>> {
    const filter: QueryFilter<TaskDocument> = {
      workspaceId: toObjectId(workspaceId),
      assigneeId: toObjectId(userId),
      archivedAt: null,
    };

    if (query.status) {
      // partial, case-insensitive — status column names vary per project,
      // so an exact match would be unusable when filtering across projects
      filter.status = { $regex: escapeRegex(query.status), $options: 'i' };
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.projectId) {
      filter.projectId = toObjectId(query.projectId);
    }

    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const direction = query.sortOrder === 'desc' ? -1 : 1;
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      createdAt: { createdAt: direction },
      updatedAt: { updatedAt: direction },
      dueDate: { dueDate: direction },
      priority: { priority: direction },
      taskNumber: { taskNumber: direction },
    };
    const sort = sortMap[query.sortBy ?? 'dueDate'] ?? { dueDate: 1 };

    const { skip, limit, page } = getPaginationParams(query);

    const [items, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('assigneeId', 'name email avatarUrl')
        .populate('reporterId', 'name email avatarUrl'),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  // ─── Filter builder ─────────────────────────────────────────────
  private buildFilter(
    projectId: string,
    query: QueryTasksDto,
  ): QueryFilter<TaskDocument> {
    const filter: QueryFilter<TaskDocument> = {
      projectId: toObjectId(projectId),
      archivedAt: null,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.assigneeId) {
      filter.assigneeId = toObjectId(query.assigneeId);
    }

    if (query.reporterId) {
      filter.reporterId = toObjectId(query.reporterId);
    }

    if (query.sprintId) {
      filter.sprintId = toObjectId(query.sprintId);
    }

    if (query.labels && query.labels.length > 0) {
      filter.labels = { $in: query.labels };
    }

    // due date range filter
    if (query.dueDateFrom || query.dueDateTo) {
      filter.dueDate = {};
      if (query.dueDateFrom) {
        filter.dueDate.$gte = new Date(query.dueDateFrom);
      }
      if (query.dueDateTo) {
        filter.dueDate.$lte = new Date(query.dueDateTo);
      }
    }

    // full-text search using MongoDB text index
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    return filter;
  }

  // ─── Sort builder ────────────────────────────────────────────────
  private buildSort(query: QueryTasksDto): Record<string, 1 | -1> {
    const direction = query.sortOrder === 'asc' ? 1 : -1;

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      createdAt: { createdAt: direction },
      updatedAt: { updatedAt: direction },
      dueDate: { dueDate: direction },
      priority: { priority: direction },
      order: { order: direction },
    };

    return sortMap[query.sortBy ?? 'order'] ?? { order: 1 };
  }
}
