import { ActivityAction } from '../enums/activity-action.enum';

// Groups the (fairly granular) ActivityAction enum into a small set of
// "modules" for filtering — the activity log itself has no separate module
// field, so this mapping is the single source of truth for both the
// workspace activity endpoint's `module` query param and any
// action -> module display logic. Keep this in sync when adding new actions.
export const ACTIVITY_MODULES = [
  'task',
  'comments',
  'attachments',
  'sprint',
  'checklist',
  'watchers',
] as const;

export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

const ACTION_MODULE_MAP: Record<ActivityAction, ActivityModule> = {
  [ActivityAction.TASK_CREATED]: 'task',
  [ActivityAction.TASK_UPDATED]: 'task',
  [ActivityAction.TASK_DELETED]: 'task',
  [ActivityAction.TASK_ARCHIVED]: 'task',
  [ActivityAction.STATUS_CHANGED]: 'task',
  [ActivityAction.PRIORITY_CHANGED]: 'task',
  [ActivityAction.ASSIGNEE_CHANGED]: 'task',
  [ActivityAction.DUE_DATE_CHANGED]: 'task',
  [ActivityAction.TITLE_CHANGED]: 'task',
  [ActivityAction.DESCRIPTION_CHANGED]: 'task',
  [ActivityAction.LABELS_CHANGED]: 'task',
  [ActivityAction.STORY_POINTS_CHANGED]: 'task',

  [ActivityAction.COMMENT_ADDED]: 'comments',
  [ActivityAction.COMMENT_EDITED]: 'comments',
  [ActivityAction.COMMENT_DELETED]: 'comments',

  [ActivityAction.ATTACHMENT_ADDED]: 'attachments',
  [ActivityAction.ATTACHMENT_REMOVED]: 'attachments',

  [ActivityAction.ADDED_TO_SPRINT]: 'sprint',
  [ActivityAction.REMOVED_FROM_SPRINT]: 'sprint',

  [ActivityAction.CHECKLIST_ITEM_ADDED]: 'checklist',
  [ActivityAction.CHECKLIST_ITEM_COMPLETED]: 'checklist',
  [ActivityAction.CHECKLIST_ITEM_REOPENED]: 'checklist',

  [ActivityAction.WATCHER_ADDED]: 'watchers',
  [ActivityAction.WATCHER_REMOVED]: 'watchers',
};

export function getActivityModule(action: ActivityAction): ActivityModule {
  return ACTION_MODULE_MAP[action];
}

// every ActivityAction that belongs to a given module — used to build the
// `action: { $in: [...] }` filter for the `module` query param
export function getActionsForModule(module: ActivityModule): ActivityAction[] {
  return (Object.keys(ACTION_MODULE_MAP) as ActivityAction[]).filter(
    (action) => ACTION_MODULE_MAP[action] === module,
  );
}
