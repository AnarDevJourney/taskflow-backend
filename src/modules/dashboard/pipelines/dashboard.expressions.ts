import { Priority } from '@modules/tasks/enums/priority.enum';

/**
 * Shared aggregation *expressions* (not stages) used by every dashboard
 * pipeline. Keeping them here is what lets the service do zero arithmetic in
 * JavaScript — percentages, bucketing and zero-filling all happen inside
 * MongoDB, so a dashboard KPI is never the result of a JS loop over documents.
 */

// ─── Status bucketing ────────────────────────────────────────────────
// `task.status` is a free string matching one of `project.statuses[].name`,
// and every project configures its own columns — so there is no enum to group
// by. The dashboard needs exactly three comparable buckets across all
// projects in a workspace, so the raw column name is normalized with a
// `$switch` over two case-insensitive patterns.
//
// Order matters: "done" is tested first so a column named "Review — Done"
// lands in `done`, not `in_progress`.

export const TASK_STATUS_BUCKETS = ['todo', 'in_progress', 'done'] as const;
export type TaskStatusBucket = (typeof TASK_STATUS_BUCKETS)[number];

export const DONE_STATUS_PATTERN = 'done|complete|closed|resolved|finish|shipped';
const IN_PROGRESS_STATUS_PATTERN =
  'progress|doing|review|testing|qa|develop|implement|started';

/** `$expr` mapping a raw `status` string onto one of TASK_STATUS_BUCKETS. */
export const statusBucketExpr = {
  $let: {
    vars: { name: { $toLower: { $ifNull: ['$status', ''] } } },
    in: {
      $switch: {
        branches: [
          {
            case: {
              $regexMatch: { input: '$$name', regex: DONE_STATUS_PATTERN },
            },
            then: 'done',
          },
          {
            case: {
              $regexMatch: { input: '$$name', regex: IN_PROGRESS_STATUS_PATTERN },
            },
            then: 'in_progress',
          },
        ],
        default: 'todo',
      },
    },
  },
};

/** Priority order used for the donut chart — highest severity first. */
export const PRIORITY_ORDER: Priority[] = [
  Priority.CRITICAL,
  Priority.HIGH,
  Priority.MEDIUM,
  Priority.LOW,
];

// ─── Generic helpers ─────────────────────────────────────────────────

/**
 * Percent change of `current` against `previous`, rounded to a whole number.
 *
 * Returns `null` when there is no baseline to compare against (`previous` is
 * 0 or missing) rather than a fake +100% — the UI hides the comparison chip
 * in that case instead of showing a number that means nothing.
 */
export function percentChangeExpr(current: unknown, previous: unknown) {
  return {
    $let: {
      vars: {
        current: { $ifNull: [current, 0] },
        previous: { $ifNull: [previous, 0] },
      },
      in: {
        $cond: [
          { $gt: ['$$previous', 0] },
          {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$$current', '$$previous'] },
                      '$$previous',
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          },
          null,
        ],
      },
    },
  };
}

/**
 * Unwraps a `[{ count: n }]`-shaped `$facet` result — or `[]` when the facet
 * matched nothing — into a plain number.
 */
export function facetCountExpr(facetField: string) {
  return { $ifNull: [{ $first: `${facetField}.count` }, 0] };
}

/** Unwraps a single-document `$facet` result into that document, or `null`. */
export function facetDocExpr(facetField: string) {
  return { $ifNull: [{ $first: facetField }, null] };
}

/**
 * Turns a `$group`-by-key facet result into a fixed-length, fixed-order array
 * with zero-filled gaps: `[{ _id: 'done', count: 3 }]` → `[{ status: 'todo',
 * count: 0 }, { status: 'in_progress', count: 0 }, { status: 'done', count: 3 }]`.
 *
 * Charts need every slice present in a stable order — a legend that grows and
 * shrinks as buckets empty out, or reorders itself between refetches, is
 * unreadable. Doing it as an expression keeps the zero-fill server-side
 * instead of leaving the client to reconcile a sparse array.
 *
 * It rescans the grouped result once per key, so it is quadratic in the key
 * count. That is irrelevant at three or four buckets and still cheap at the
 * heatmap's 371 days (the inner array only holds days that saw activity). A
 * lookup-object version via `$arrayToObject` + `$getField` was tried and
 * rejected: `$getField` will not take a variable as its `field`, only a
 * constant, so it cannot be driven from a `$map`.
 */
export function bucketCountsExpr(
  facetField: string,
  buckets: readonly string[],
  keyName: string,
) {
  return {
    $map: {
      input: buckets as string[],
      as: 'bucket',
      in: {
        [keyName]: '$$bucket',
        count: {
          $ifNull: [
            {
              $first: {
                $map: {
                  input: {
                    $filter: {
                      input: facetField,
                      as: 'row',
                      cond: { $eq: ['$$row._id', '$$bucket'] },
                    },
                  },
                  as: 'row',
                  in: '$$row.count',
                },
              },
            },
            0,
          ],
        },
      },
    },
  };
}
