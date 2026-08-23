import { PipelineStage, Types } from 'mongoose';
import { DashboardRanges } from '../utils/date-ranges';
import { bucketCountsExpr } from './dashboard.expressions';

export interface ActivityPipelineParams {
  workspaceId: Types.ObjectId;
  /** narrows both facets to one project when the dashboard's project filter is set */
  projectId: Types.ObjectId | null;
  /** how many rows the Recent Activity widget shows */
  limit: number;
  ranges: DashboardRanges;
  /** real collection names, read off the Mongoose models (never hardcoded) */
  collections: { users: string; tasks: string; projects: string };
}

/**
 * Everything the dashboard reads out of the audit log, in one pass.
 *
 * Two `$facet` branches over the same workspace-scoped stream:
 *  - `recent` — the newest few entries, with actor / task / project attached,
 *    for the Recent Activity widget.
 *  - `heatmap` — a count per calendar day for the contribution grid.
 *
 * They share the `$match`, so the collection is scanned once for both. The
 * `$limit` in `recent` sits before its three `$lookup`s, so only the rows
 * actually rendered are ever joined.
 */
export function buildActivityPipeline({
  workspaceId,
  projectId,
  limit,
  ranges,
  collections,
}: ActivityPipelineParams): PipelineStage[] {
  const { heatmapStart, heatmapDays, timezone } = ranges;

  return [
    { $match: { workspaceId, ...(projectId ? { projectId } : {}) } },
    {
      $facet: {
        recent: [
          { $sort: { createdAt: -1 } },
          { $limit: limit },

          ...refLookup(collections.users, 'actorId', 'actor', {
            name: 1,
            avatarUrl: 1,
          }),
          ...refLookup(collections.tasks, 'taskId', 'task', {
            title: 1,
            taskNumber: 1,
          }),
          ...refLookup(collections.projects, 'projectId', 'project', {
            name: 1,
          }),

          {
            $project: {
              _id: 1,
              action: 1,
              module: 1,
              field: 1,
              createdAt: 1,
              actor: 1,
              task: 1,
              project: 1,
            },
          },
        ],

        // Bucketed by the same formatted local-day string the productivity
        // trend uses, with `timezone` passed explicitly — grouping by UTC day
        // would slide entries into the neighbouring cell for anyone whose
        // offset is far from zero.
        heatmap: [
          { $match: { createdAt: { $gte: heatmapStart } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: '$createdAt',
                  format: '%Y-%m-%d',
                  timezone,
                },
              },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        recentActivities: '$recent',
        // every day in the window, in grid order, zeros included — the client
        // renders one cell per entry and never does date arithmetic of its own
        heatmapDays: bucketCountsExpr('$heatmap', heatmapDays, 'date'),
      },
    },
  ];
}

/** `$lookup` on a single ref + unwrap the resulting one-element array. */
function refLookup(
  from: string,
  localField: string,
  as: string,
  projection: Record<string, 1>,
): PipelineStage.FacetPipelineStage[] {
  return [
    {
      $lookup: {
        from,
        localField,
        foreignField: '_id',
        as,
        pipeline: [{ $project: projection }],
      },
    },
    { $addFields: { [as]: { $ifNull: [{ $first: `$${as}` }, null] } } },
  ];
}
