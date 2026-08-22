import { PipelineStage, Types } from 'mongoose';
import { SprintStatus } from '@modules/sprints/schemas/sprint.schema';
import { DashboardRanges } from '../utils/date-ranges';
import {
  bucketCountsExpr,
  DONE_STATUS_PATTERN,
  facetCountExpr,
  facetDocExpr,
  percentChangeExpr,
  PRIORITY_ORDER,
  statusBucketExpr,
  TASK_STATUS_BUCKETS,
} from './dashboard.expressions';

export interface TaskOverviewPipelineParams {
  workspaceId: Types.ObjectId;
  /** the caller — only the "my tasks" facet is scoped to them */
  userId: Types.ObjectId;
  ranges: DashboardRanges;
  /** real collection names, read off the Mongoose models (never hardcoded) */
  collections: { projects: string; sprints: string; users: string };
}

/** how many rows the two list widgets show */
const LIST_LIMIT = 5;

/** how many people the workload chart plots, busiest first */
const WORKLOAD_LIMIT = 8;

/**
 * One pipeline, one pass over the workspace's tasks, every task-derived
 * dashboard number.
 *
 * The shape is: a single `$match` narrowing to the workspace (served by the
 * `{ projectId, status, order }` / `{ workspaceId, assigneeId }` indexes),
 * one `$addFields` that normalizes the free-string status into a comparable
 * bucket, then a `$facet` that forks that same stream into every KPI, both
 * chart distributions, the two lists and the sprint roll-up — followed by a
 * `$project` that assembles the final response shape.
 *
 * This is what replaces what would otherwise be ~8 `countDocuments()` calls
 * plus two `find()`s: MongoDB reads the matched documents once and every
 * branch of the `$facet` sees them from memory.
 */
export function buildTaskOverviewPipeline({
  workspaceId,
  userId,
  ranges,
  collections,
}: TaskOverviewPipelineParams): PipelineStage[] {
  const {
    now,
    todayEnd,
    weekStart,
    monthStart,
    prevMonthStart,
    todayStart,
    deadlineHorizon,
    trendStart,
    trendDays,
    timezone,
  } = ranges;

  const isDone = { $eq: ['$statusBucket', 'done'] };
  const isNotDone = { $ne: ['$statusBucket', 'done'] };

  return [
    // ─── Scope ───────────────────────────────────────────────────────
    { $match: { workspaceId, archivedAt: null } },

    // Normalize once, up front, so every facet below can group and filter on
    // a three-value enum instead of re-running the `$switch` per branch.
    { $addFields: { statusBucket: statusBucketExpr } },

    {
      $facet: {
        // ─── KPI 1 — active tasks, vs. a week ago ──────────────────
        // `previous` reconstructs how many tasks were active 7 days ago:
        // created before the window opened, and either still not done or
        // only finished inside the window. Tasks are never un-archived, so
        // this is exact for everything except a task whose status was
        // changed more than once since — close enough for a trend chip, and
        // it needs no extra history collection.
        activeTasks: [
          {
            $group: {
              _id: null,
              current: { $sum: { $cond: [isNotDone, 1, 0] } },
              previous: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $lt: ['$createdAt', weekStart] },
                        {
                          $or: [
                            isNotDone,
                            { $gte: ['$updatedAt', weekStart] },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],

        // ─── KPI 2 — overdue tasks, vs. a week ago ─────────────────
        // Same population both sides (still-unfinished tasks with a due
        // date), only the cut-off moves — so the comparison answers "is the
        // overdue backlog growing?".
        overdueTasks: [
          { $match: { dueDate: { $ne: null } } },
          {
            $group: {
              _id: null,
              current: {
                $sum: {
                  $cond: [
                    { $and: [isNotDone, { $lt: ['$dueDate', now] }] },
                    1,
                    0,
                  ],
                },
              },
              previous: {
                $sum: {
                  $cond: [
                    { $and: [isNotDone, { $lt: ['$dueDate', weekStart] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],

        // ─── KPI 3 — completed this month, vs. last month ──────────
        // `Task` has no `completedAt`, so `updatedAt` on a done task is the
        // best available completion timestamp. It over-counts a done task
        // that was edited later in a different month; adding a real
        // `completedAt` would be the fix, but that changes the data model.
        completedThisMonth: [
          { $match: { $expr: isDone } },
          {
            $group: {
              _id: null,
              current: {
                $sum: { $cond: [{ $gte: ['$updatedAt', monthStart] }, 1, 0] },
              },
              previous: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$updatedAt', prevMonthStart] },
                        { $lt: ['$updatedAt', monthStart] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],

        // ─── Donut 1 — status distribution (whole workspace) ───────
        taskStatus: [{ $group: { _id: '$statusBucket', count: { $sum: 1 } } }],

        // ─── Line — tasks completed per day, last 7 days ───────────
        // Same `updatedAt`-as-completion-time proxy the completedThisMonth
        // KPI uses (see its note above), just bucketed by day instead of
        // month. Grouped by a formatted local-day string rather than
        // `$dateTrunc` so the keys match `ranges.trendDays` exactly and the
        // zero-fill in the final `$project` is a plain string comparison.
        productivityTrend: [
          { $match: { $expr: isDone, updatedAt: { $gte: trendStart } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: '$updatedAt',
                  format: '%Y-%m-%d',
                  timezone,
                },
              },
              count: { $sum: 1 },
            },
          },
        ],

        // ─── Donut 2 — priority distribution (open work only) ──────
        // Scoped to not-done tasks on purpose: priority on finished work
        // says nothing about where the team should be looking now.
        priorityDistribution: [
          { $match: { $expr: isNotDone } },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ],

        // ─── Bars — open work per assignee ─────────────────────────
        // Scoped to unfinished work, same as the priority donut: "workload"
        // means what someone still has to do, not what they have ever done.
        // Unassigned tasks are excluded by the `assigneeId` match — the chart
        // is by assignee, and a phantom "nobody" bar would out-rank real
        // people while naming no one to talk to about it.
        //
        // Capped at the busiest few: a bar per member is unreadable in a
        // workspace with thirty of them, and the tail is by definition the
        // people who are not the problem.
        workloadByAssignee: [
          { $match: { assigneeId: { $ne: null }, $expr: isNotDone } },
          { $group: { _id: '$assigneeId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: WORKLOAD_LIMIT },
          {
            $lookup: {
              from: collections.users,
              localField: '_id',
              foreignField: '_id',
              as: 'user',
              pipeline: [{ $project: { name: 1, avatarUrl: 1 } }],
            },
          },
          { $addFields: { user: { $first: '$user' } } },
          {
            $project: {
              _id: 0,
              userId: '$_id',
              // a task can outlive the user row it points at; the client
              // falls back to a placeholder rather than rendering an empty bar
              name: { $ifNull: ['$user.name', null] },
              avatarUrl: { $ifNull: ['$user.avatarUrl', null] },
              count: 1,
            },
          },
        ],

        // ─── Widget — my tasks for today ───────────────────────────
        // Assigned to the caller, unfinished, due today or already past due.
        myTasks: [
          {
            $match: {
              assigneeId: userId,
              dueDate: { $ne: null, $lte: todayEnd },
              $expr: isNotDone,
            },
          },
          { $sort: { dueDate: 1, priority: 1 } },
          { $limit: LIST_LIMIT },
          ...projectLookupStages(collections.projects),
          taskListProjection(),
        ],

        // `myTasks` is capped at 5 rows but the widget's header shows the
        // real remaining count, so the total is counted separately. Nested
        // `$facet` is not allowed, hence a sibling facet rather than a
        // sub-facet of `myTasks`.
        myTasksTotal: [
          {
            $match: {
              assigneeId: userId,
              dueDate: { $ne: null, $lte: todayEnd },
              $expr: isNotDone,
            },
          },
          { $count: 'count' },
        ],

        // ─── Widget — upcoming deadlines (whole workspace) ─────────
        upcomingDeadlines: [
          {
            $match: {
              dueDate: { $gte: todayStart, $lte: deadlineHorizon },
              $expr: isNotDone,
            },
          },
          { $sort: { dueDate: 1, priority: 1 } },
          { $limit: LIST_LIMIT },
          ...projectLookupStages(collections.projects),
          taskListProjection(),
        ],

        // ─── Widget — sprint progress ──────────────────────────────
        // A workspace can have several projects running a sprint at once;
        // the dashboard shows the busiest one (`$sort` by task count, then
        // `$limit: 1`). The `$lookup` sub-pipeline filters to active sprints
        // so a task belonging to a planned or completed sprint drops out
        // before the roll-up rather than after it.
        sprint: [
          { $match: { sprintId: { $ne: null } } },
          {
            $lookup: {
              from: collections.sprints,
              localField: 'sprintId',
              foreignField: '_id',
              as: 'sprint',
              pipeline: [
                { $match: { status: SprintStatus.ACTIVE } },
                { $project: { name: 1, startDate: 1, endDate: 1 } },
              ],
            },
          },
          { $match: { 'sprint.0': { $exists: true } } },
          { $addFields: { activeSprint: { $first: '$sprint' } } },
          {
            $group: {
              _id: '$activeSprint._id',
              name: { $first: '$activeSprint.name' },
              startDate: { $first: '$activeSprint.startDate' },
              endDate: { $first: '$activeSprint.endDate' },
              total: { $sum: 1 },
              completed: { $sum: { $cond: [isDone, 1, 0] } },
              inProgress: {
                $sum: {
                  $cond: [{ $eq: ['$statusBucket', 'in_progress'] }, 1, 0],
                },
              },
              todo: {
                $sum: { $cond: [{ $eq: ['$statusBucket', 'todo'] }, 1, 0] },
              },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 1 },
          {
            $project: {
              _id: 0,
              id: '$_id',
              name: 1,
              startDate: 1,
              endDate: 1,
              total: 1,
              completed: 1,
              inProgress: 1,
              todo: 1,
              progress: {
                $cond: [
                  { $gt: ['$total', 0] },
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ['$completed', '$total'] },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        ],
      },
    },

    // ─── Assemble the response shape ─────────────────────────────────
    // Every facet above returns an array; this stage unwraps the single-row
    // ones, computes the trend percentages, and zero-fills the two chart
    // distributions so the client receives exactly what it renders.
    {
      $project: {
        _id: 0,
        kpis: {
          activeTasks: kpiExpr('$activeTasks'),
          overdueTasks: kpiExpr('$overdueTasks'),
          completedThisMonth: kpiExpr('$completedThisMonth'),
        },
        taskStatus: bucketCountsExpr('$taskStatus', TASK_STATUS_BUCKETS, 'status'),
        priorityDistribution: bucketCountsExpr(
          '$priorityDistribution',
          PRIORITY_ORDER,
          'priority',
        ),
        productivityTrend: bucketCountsExpr(
          '$productivityTrend',
          trendDays,
          'date',
        ),
        workloadByAssignee: 1,
        myTasks: 1,
        myTasksTotal: facetCountExpr('$myTasksTotal'),
        upcomingDeadlines: 1,
        sprint: facetDocExpr('$sprint'),
      },
    },
  ];
}

/**
 * `{ current, previous, changePercent }` for one of the counting facets.
 * Shared by all three task KPIs (and mirrored by the notifications pipeline)
 * so every card on the dashboard reads the same shape.
 */
function kpiExpr(facetField: string) {
  const current = { $ifNull: [{ $first: `${facetField}.current` }, 0] };
  const previous = { $ifNull: [{ $first: `${facetField}.previous` }, 0] };

  return {
    current,
    previous,
    changePercent: percentChangeExpr(current, previous),
  };
}

/**
 * Attaches the task's project — name and color for display, plus the name of
 * that project's "done" column so the My Tasks widget's checkbox knows what
 * to PATCH the task to. Columns are per-project and free-form, so the target
 * status cannot be a constant on the client.
 *
 * Falls back to the last column in board order when a project has no column
 * whose name reads as "done", which is the conventional meaning of the
 * right-most column on a kanban board.
 */
function projectLookupStages(projectsCollection: string): PipelineStage.FacetPipelineStage[] {
  return [
    {
      $lookup: {
        from: projectsCollection,
        localField: 'projectId',
        foreignField: '_id',
        as: 'project',
        pipeline: [
          {
            $project: {
              name: 1,
              color: 1,
              doneStatus: {
                $let: {
                  vars: {
                    doneNames: {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ['$statuses', []] },
                            as: 'status',
                            cond: {
                              $regexMatch: {
                                input: { $toLower: '$$status.name' },
                                regex: DONE_STATUS_PATTERN,
                              },
                            },
                          },
                        },
                        as: 'status',
                        in: '$$status.name',
                      },
                    },
                    orderedNames: {
                      $map: {
                        input: {
                          $sortArray: {
                            input: { $ifNull: ['$statuses', []] },
                            sortBy: { order: 1 },
                          },
                        },
                        as: 'status',
                        in: '$$status.name',
                      },
                    },
                  },
                  in: {
                    $ifNull: [
                      { $first: '$$doneNames' },
                      { $last: '$$orderedNames' },
                    ],
                  },
                },
              },
            },
          },
        ],
      },
    },
    { $addFields: { project: { $first: '$project' } } },
  ];
}

/** The task fields both list widgets render — nothing more. */
function taskListProjection(): PipelineStage.FacetPipelineStage {
  return {
    $project: {
      _id: 1,
      taskNumber: 1,
      title: 1,
      status: 1,
      statusBucket: 1,
      priority: 1,
      dueDate: 1,
      projectId: 1,
      project: {
        $cond: [
          { $ifNull: ['$project', false] },
          {
            _id: '$project._id',
            name: '$project.name',
            color: '$project.color',
            doneStatus: '$project.doneStatus',
          },
          null,
        ],
      },
    },
  };
}
