import { Types } from 'mongoose';
import { Priority } from '@modules/tasks/enums/priority.enum';
import { TaskStatusBucket } from '../pipelines/dashboard.expressions';

/**
 * One KPI card's numbers.
 *
 * `changePercent` is `null` when the previous period had nothing to compare
 * against — the card hides its comparison chip rather than printing a
 * meaningless +100%.
 */
export interface DashboardKpi {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface DashboardKpis {
  activeTasks: DashboardKpi;
  overdueTasks: DashboardKpi;
  completedThisMonth: DashboardKpi;
  unreadNotifications: DashboardKpi;
}

export interface DashboardStatusSlice {
  status: TaskStatusBucket;
  count: number;
}

export interface DashboardPrioritySlice {
  priority: Priority;
  count: number;
}

/** One day of the productivity trend line. */
export interface DashboardTrendPoint {
  /** local calendar day, `YYYY-MM-DD` — the client formats the axis label */
  date: string;
  count: number;
}

/** One bar of the workload chart — a person and their open task count. */
export interface DashboardWorkloadEntry {
  userId: Types.ObjectId;
  /** null if the assignee's user row no longer exists */
  name: string | null;
  avatarUrl: string | null;
  count: number;
}

/** One cell of the contribution grid. */
export interface DashboardHeatmapDay {
  /** local calendar day, `YYYY-MM-DD` */
  date: string;
  count: number;
}

export interface DashboardActivityHeatmap {
  /** 53 weeks x 7 days, oldest first, Monday-first, zero-filled */
  days: DashboardHeatmapDay[];
  /** today in the server's calendar — cells past this one are in the future */
  today: string;
}

export interface DashboardTaskProject {
  _id: Types.ObjectId;
  name: string;
  color: string;
  /**
   * The name of this project's "done" column. Sent so the My Tasks widget's
   * checkbox can complete a task without the client guessing what a finished
   * status is called in that particular project.
   */
  doneStatus: string | null;
}

export interface DashboardTask {
  _id: Types.ObjectId;
  taskNumber: number;
  title: string;
  /** raw, project-specific column name */
  status: string;
  /** the normalized three-value bucket the charts group by */
  statusBucket: TaskStatusBucket;
  priority: Priority;
  dueDate: Date | null;
  projectId: Types.ObjectId;
  project: DashboardTaskProject | null;
}

export interface DashboardActivity {
  _id: Types.ObjectId;
  action: string;
  module: string;
  field: string | null;
  createdAt: Date;
  actor: { _id: Types.ObjectId; name: string; avatarUrl: string | null } | null;
  task: { _id: Types.ObjectId; title: string; taskNumber: number } | null;
  project: { _id: Types.ObjectId; name: string } | null;
}

export interface DashboardSprint {
  id: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  /** whole-number percentage, already rounded by the pipeline */
  progress: number;
}

/** Everything the dashboard page renders, from one request. */
export interface DashboardOverview {
  kpis: DashboardKpis;
  taskStatus: DashboardStatusSlice[];
  priorityDistribution: DashboardPrioritySlice[];
  /** tasks completed per day over the last 7 days, oldest first, zero-filled */
  productivityTrend: DashboardTrendPoint[];
  /** open tasks per assignee, busiest first, capped at the top few */
  workloadByAssignee: DashboardWorkloadEntry[];
  myTasks: DashboardTask[];
  /** total tasks due today, of which `myTasks` holds at most the first five */
  myTasksTotal: number;
  recentActivities: DashboardActivity[];
  /** activity-log density per day, for the contribution grid */
  activityHeatmap: DashboardActivityHeatmap;
  upcomingDeadlines: DashboardTask[];
  sprint: DashboardSprint | null;
}

/** The activity pipeline's output — both of its `$facet` branches. */
export interface ActivityPipelineResult {
  recentActivities: DashboardActivity[];
  heatmapDays: DashboardHeatmapDay[];
}

/** The task pipeline's output — everything except the two other collections. */
export type TaskOverviewResult = Omit<
  DashboardOverview,
  'kpis' | 'recentActivities'
> & {
  kpis: Omit<DashboardKpis, 'unreadNotifications'>;
};
