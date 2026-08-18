// BullMQ queue + job names for the notification pipeline.
export const NOTIFICATIONS_QUEUE = 'notifications';

// a notification event fanned out to one or more recipients
export const JOB_CREATE_NOTIFICATION = 'create-notification';

// periodic scan for due-soon / overdue tasks (repeatable job)
export const JOB_SCAN_DUE_TASKS = 'scan-due-tasks';

// how far ahead a due date counts as "due soon"
export const DUE_SOON_WINDOW_HOURS = 24;

// ─── Socket.io event names (shared contract with the frontend) ─────
export const WS_EVENT_NEW = 'notification:new';
export const WS_EVENT_COUNT = 'notification:count';
