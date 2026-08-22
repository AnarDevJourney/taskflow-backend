import { PipelineStage, Types } from 'mongoose';
import { DashboardRanges } from '../utils/date-ranges';
import { facetCountExpr, percentChangeExpr } from './dashboard.expressions';

export interface NotificationsKpiPipelineParams {
  recipientId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  ranges: DashboardRanges;
}

/**
 * The fourth KPI card. Notifications live in their own collection, so this
 * cannot be a branch of the task `$facet` — but it is still a single
 * aggregation returning a finished `{ current, previous, changePercent }`,
 * and it runs in parallel with the other two dashboard pipelines.
 *
 * Scoped to the workspace being viewed, not to the whole account, so the
 * number agrees with the rest of the dashboard. It will therefore be smaller
 * than the topbar bell badge, which is intentionally account-wide.
 *
 * `previous` mirrors the activeTasks KPI's reconstruction: how many were
 * unread 7 days ago — delivered before the window opened, and either still
 * unread or only read inside it.
 */
export function buildNotificationsKpiPipeline({
  recipientId,
  workspaceId,
  ranges,
}: NotificationsKpiPipelineParams): PipelineStage[] {
  const { weekStart } = ranges;

  return [
    // served by the { recipientId, isRead, createdAt } index
    { $match: { recipientId, workspaceId } },
    {
      $facet: {
        unread: [{ $match: { isRead: false } }, { $count: 'count' }],
        unreadAWeekAgo: [
          {
            $match: {
              createdAt: { $lt: weekStart },
              $or: [{ isRead: false }, { readAt: { $gte: weekStart } }],
            },
          },
          { $count: 'count' },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        current: facetCountExpr('$unread'),
        previous: facetCountExpr('$unreadAWeekAgo'),
        changePercent: percentChangeExpr(
          facetCountExpr('$unread'),
          facetCountExpr('$unreadAWeekAgo'),
        ),
      },
    },
  ];
}
