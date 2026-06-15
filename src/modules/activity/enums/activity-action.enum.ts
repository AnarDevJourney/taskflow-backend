export enum ActivityAction {
  // Task lifecycle
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  TASK_ARCHIVED = 'task_archived',

  // Field changes
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  ASSIGNEE_CHANGED = 'assignee_changed',
  DUE_DATE_CHANGED = 'due_date_changed',
  TITLE_CHANGED = 'title_changed',
  DESCRIPTION_CHANGED = 'description_changed',
  LABELS_CHANGED = 'labels_changed',
  STORY_POINTS_CHANGED = 'story_points_changed',

  // Comments
  COMMENT_ADDED = 'comment_added',
  COMMENT_EDITED = 'comment_edited',
  COMMENT_DELETED = 'comment_deleted',

  // Attachments
  ATTACHMENT_ADDED = 'attachment_added',
  ATTACHMENT_REMOVED = 'attachment_removed',

  // Sprint
  ADDED_TO_SPRINT = 'added_to_sprint',
  REMOVED_FROM_SPRINT = 'removed_from_sprint',

  // Checklist
  CHECKLIST_ITEM_ADDED = 'checklist_item_added',
  CHECKLIST_ITEM_COMPLETED = 'checklist_item_completed',
  CHECKLIST_ITEM_REOPENED = 'checklist_item_reopened',

  // Watchers
  WATCHER_ADDED = 'watcher_added',
  WATCHER_REMOVED = 'watcher_removed',
}
