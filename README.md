# TaskFlow

A modern internal task management system built with NestJS. Designed for development teams who need a clean, fast, and straightforward tool to plan work, track tasks, and collaborate — without the complexity of enterprise tools like Jira.

---

## Features

**Task Management**

- Create and manage tasks with title, description, status, priority, assignee, due date, labels, and story points
- Drag-and-drop reordering on kanban boards
- Bulk update tasks (status, priority, assignee, labels)
- Checklists, file attachments, task links, and watchers
- Human-readable task IDs per project (e.g. TF-1, TF-2)

**Projects & Workspaces**

- Workspace-level organization with role-based access control
- Customizable kanban columns per project (name, color, WIP limits)
- Project-level member management with role overrides
- Sprint mode toggle per project

**Sprint Planning**

- Create and manage sprints with start/end dates and sprint goals
- Start and complete sprints with configurable handling of incomplete tasks
- Velocity tracking and burndown chart data

**Collaboration**

- Task comments with @mention support
- Real-time notifications via WebSocket
- Email notifications for assignments, due dates, and mentions
- Full activity log and audit trail on every task

**Authentication**

- Invite-only registration — users join via email invite from workspace admin
- JWT authentication with short-lived access tokens (15 min) and rotating refresh tokens (7 days)
- HttpOnly cookie storage — tokens never accessible to JavaScript
- Password reset via email

**Search**

- Global search across tasks, projects, and members
- Project-scoped search with task number support (e.g. searching "TF-42")

---

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Framework      | NestJS + TypeScript                 |
| Database       | MongoDB + Mongoose                  |
| Cache          | Redis                               |
| File Storage   | MinIO (S3-compatible)               |
| Real-time      | Socket.io (WebSockets)              |
| Email          | Nodemailer + Handlebars             |
| Authentication | JWT + Passport                      |
| Validation     | class-validator + class-transformer |

---

## Architecture

The backend follows NestJS module-based architecture. Each feature is fully self-contained with its own schema, DTOs, service, and controller.

```
src/
├── config/                  # Environment validation and typed config service
├── database/                # MongoDB connection
├── common/                  # Shared guards, decorators, filters, interceptors, utils
└── modules/
    ├── auth/                # Login, register, refresh, password reset, invites
    ├── users/               # User schema
    ├── workspaces/          # Workspace CRUD and member management
    ├── projects/            # Project CRUD and kanban status configuration
    ├── tasks/               # Task CRUD, filtering, bulk ops, drag-drop
    ├── comments/            # Task comments and @mentions
    ├── sprints/             # Sprint planning, velocity, burndown
    ├── activity/            # Immutable audit log
    ├── notifications/       # In-app and email notifications
    ├── files/               # MinIO file upload and signed URL generation
    └── search/              # Full-text search across tasks, projects, members
```

---

## API Overview

All endpoints are prefixed with `/api/v1`. Every response follows a consistent envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "statusCode": 404, "message": "...", "path": "..." } }
```

| Module        | Base Path                                             |
| ------------- | ----------------------------------------------------- |
| Auth          | `/auth`                                               |
| Workspaces    | `/workspaces`                                         |
| Projects      | `/workspaces/:wsId/projects`                          |
| Tasks         | `/workspaces/:wsId/projects/:pId/tasks`               |
| Comments      | `/workspaces/:wsId/projects/:pId/tasks/:tId/comments` |
| Sprints       | `/workspaces/:wsId/projects/:pId/sprints`             |
| Activity      | `/workspaces/:wsId/projects/:pId/activity`            |
| Notifications | `/notifications`                                      |
| Files         | `/files`                                              |
| Search        | `/search`                                             |

---

## Roles & Permissions

| Role   | Scope     | Description                                              |
| ------ | --------- | -------------------------------------------------------- |
| Owner  | Workspace | Full control. Can archive workspace, manage all members. |
| Admin  | Workspace | Can manage members, create projects, edit settings.      |
| Member | Workspace | Can create and manage tasks, comment, join projects.     |
| Viewer | Workspace | Read-only access to all projects.                        |
| Guest  | Project   | Access limited to specific projects only.                |

---

## Project Status

Backend is complete. Frontend (React + TypeScript) and Docker Compose setup are in progress.

---

## Author

**Anar** — [github.com/AnarDevJourney](https://github.com/AnarDevJourney)
