import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '@modules/tasks/schemas/task.schema';
import { Project, ProjectDocument } from '@modules/projects/schemas/project.schema';
import { Sprint, SprintDocument } from '@modules/sprints/schemas/sprint.schema';
import { User, UserDocument } from '@modules/users/schemas/user.schema';
import {
  Notification,
  NotificationDocument,
} from '@modules/notifications/schemas/notification.schema';
import {
  ActivityLog,
  ActivityLogDocument,
} from '@modules/activity/schemas/activity-log.schema';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { toObjectId } from '@common/utils/object-id';
import { buildDashboardRanges } from './utils/date-ranges';
import { buildTaskOverviewPipeline } from './pipelines/task-overview.pipeline';
import { buildNotificationsKpiPipeline } from './pipelines/notifications.pipeline';
import { buildActivityPipeline } from './pipelines/activity.pipeline';
import {
  ActivityPipelineResult,
  DashboardKpi,
  DashboardOverview,
  TaskOverviewResult,
} from './types/dashboard-overview.interface';

/** how many rows the Recent Activity widget shows */
const RECENT_ACTIVITY_LIMIT = 5;

const EMPTY_KPI: DashboardKpi = { current: 0, previous: 0, changePercent: null };

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Sprint.name) private sprintModel: Model<SprintDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
    private workspacesService: WorkspacesService,
  ) {}

  /**
   * Everything the dashboard page renders, in one response.
   *
   * Three aggregations, one per collection involved, issued in parallel —
   * not eight `countDocuments()` calls. The task pipeline is a single
   * `$facet` covering all six task-derived statistics plus both list widgets
   * and the sprint roll-up; the other two exist only because MongoDB cannot
   * `$facet` across collections. Every number in the response is computed by
   * the database: nothing below sums, divides or counts in JavaScript.
   *
   * Scoping, deliberately mixed and worth knowing when reading the numbers:
   *  - KPIs 1–3, both donut charts, Upcoming Deadlines, Sprint Progress and
   *    Recent Activity are **workspace-wide** — this is a team dashboard.
   *  - My Tasks and the unread-notifications KPI are **the caller's own**.
   */
  async getOverview(
    workspaceId: string,
    user: UserDocument,
  ): Promise<DashboardOverview> {
    // throws 404 if the workspace doesn't exist, 403 if the caller isn't a
    // member — the only permission gate the dashboard needs, since every
    // pipeline below is scoped to this one workspace
    await this.workspacesService.findOne(workspaceId, user);

    const workspaceObjectId = toObjectId(workspaceId);
    const userId = user._id as Types.ObjectId;
    const ranges = buildDashboardRanges();

    const [taskOverview, notificationsKpi, activity] = await Promise.all([
      this.taskModel
        .aggregate<TaskOverviewResult>(
          buildTaskOverviewPipeline({
            workspaceId: workspaceObjectId,
            userId,
            ranges,
            collections: {
              // read off the models rather than hardcoded, so a schema's
              // collection name can change without silently breaking a $lookup
              projects: this.projectModel.collection.name,
              sprints: this.sprintModel.collection.name,
              users: this.userModel.collection.name,
            },
          }),
        )
        .exec(),

      this.notificationModel
        .aggregate<DashboardKpi>(
          buildNotificationsKpiPipeline({
            recipientId: userId,
            workspaceId: workspaceObjectId,
            ranges,
          }),
        )
        .exec(),

      this.activityLogModel
        .aggregate<ActivityPipelineResult>(
          buildActivityPipeline({
            workspaceId: workspaceObjectId,
            limit: RECENT_ACTIVITY_LIMIT,
            ranges,
            collections: {
              users: this.userModel.collection.name,
              tasks: this.taskModel.collection.name,
              projects: this.projectModel.collection.name,
            },
          }),
        )
        .exec(),
    ]);

    return this.toResponse(
      taskOverview[0],
      notificationsKpi[0],
      activity[0],
      ranges.todayKey,
    );
  }

  /**
   * Stitches the three pipeline results into the response shape.
   *
   * The only work here is filling in defaults for an empty workspace: a
   * `$facet` over zero matched documents produces no output document at all,
   * so `taskOverview` is `undefined` for a workspace with no tasks yet. No
   * statistic is computed in this method.
   */
  private toResponse(
    taskOverview: TaskOverviewResult | undefined,
    notificationsKpi: DashboardKpi | undefined,
    activity: ActivityPipelineResult | undefined,
    todayKey: string,
  ): DashboardOverview {
    return {
      kpis: {
        activeTasks: taskOverview?.kpis.activeTasks ?? EMPTY_KPI,
        overdueTasks: taskOverview?.kpis.overdueTasks ?? EMPTY_KPI,
        completedThisMonth: taskOverview?.kpis.completedThisMonth ?? EMPTY_KPI,
        unreadNotifications: notificationsKpi ?? EMPTY_KPI,
      },
      taskStatus: taskOverview?.taskStatus ?? [],
      priorityDistribution: taskOverview?.priorityDistribution ?? [],
      productivityTrend: taskOverview?.productivityTrend ?? [],
      workloadByAssignee: taskOverview?.workloadByAssignee ?? [],
      myTasks: taskOverview?.myTasks ?? [],
      myTasksTotal: taskOverview?.myTasksTotal ?? 0,
      recentActivities: activity?.recentActivities ?? [],
      activityHeatmap: {
        days: activity?.heatmapDays ?? [],
        today: todayKey,
      },
      upcomingDeadlines: taskOverview?.upcomingDeadlines ?? [],
      sprint: taskOverview?.sprint ?? null,
    };
  }
}
