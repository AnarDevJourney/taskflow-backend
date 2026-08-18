// Deep links stored on notifications.
//
// These are **relative** paths matching the frontend router, so clicking a
// notification navigates inside the SPA instead of triggering a full page
// load. Prefix them with AppConfigService.appUrl when a link has to leave
// the app (emails).

export const taskLink = (
  workspaceId: string,
  projectId: string,
  taskId: string,
): string =>
  `/workspaces/${workspaceId}/projects/${projectId}/board?task=${taskId}`;

export const sprintsLink = (workspaceId: string, projectId: string): string =>
  `/workspaces/${workspaceId}/projects/${projectId}/sprints`;

export const workspaceMembersLink = (workspaceId: string): string =>
  `/workspaces/${workspaceId}/members`;
