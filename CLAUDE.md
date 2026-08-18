# TaskFlow — Backend (NestJS)

## Project Overview

Internal task management application. NestJS + MongoDB + Redis backend.
REST API with JWT authentication (HttpOnly cookies), WebSockets for real-time updates.

---

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: MongoDB via Mongoose
- **Cache / Queue**: Redis + BullMQ (`@nestjs/bullmq`)
- **Auth**: JWT (access token 15min, refresh token 7d) via Passport
- **Real-time**: Socket.io
- **File storage**: MinIO (S3-compatible)
- **Email**: Nodemailer + Handlebars templates
- **Validation**: class-validator + class-transformer
- **User-Agent parsing**: ua-parser-js (Activity Log's `browser`/`os`/`device` fields)
- **Containerization**: Docker + Docker Compose (dev and prod modes)

---

## Folder Structure

```
src/
├── config/               # env validation, typed config service
├── database/             # mongoose connection
├── common/
│   ├── decorators/       # @CurrentUser, @Public, @Roles
│   ├── guards/           # JwtAuthGuard, RolesGuard
│   ├── filters/          # HttpExceptionFilter (global)
│   ├── interceptors/     # TransformInterceptor, LoggingInterceptor
│   ├── middleware/       # RequestContextMiddleware (global, captures IP + User-Agent per request)
│   ├── context/          # request-context.ts — AsyncLocalStorage store read by ActivityService.log()
│   └── utils/            # pagination, object-id, slug helpers
└── modules/
    ├── auth/             # login, register, invite, refresh, reset password
    ├── users/            # user schema (shared)
    ├── workspaces/       # workspace CRUD + member management
    ├── projects/         # project CRUD + kanban status config
    ├── tasks/            # task CRUD + bulk ops + filtering
    ├── comments/         # task comments + @mentions
    ├── sprints/          # sprint planning + burndown
    ├── activity/         # audit log (immutable)
    ├── notifications/    # in-app + email notifications
    ├── files/            # MinIO upload/download
    ├── search/           # full-text search
    ├── table-settings/   # per-user saved table preferences (view style, page size, column visibility/order), keyed by a `key` string per table (e.g. "myTasks")
    └── sidebar-settings/ # per-user saved sidebar preferences (nav module visibility/order, collapsed state) — one doc per user, singular Get/Put (no `key`)

scripts/                  # bash scripts for running the project (see Docker section)
├── dev.sh
├── prod.sh
└── stop.sh

Dockerfile                  # multi-stage: builder → development → production
docker-compose.dev.yml      # hot-reload dev environment (mounted src/)
docker-compose.prod.yml     # production-style build (compiled dist/)
.env.docker                 # env vars used by both compose files (gitignored)
.env                        # env vars used when running outside Docker (gitignored)
```

---

## Architecture Rules

### Module structure

Every feature module follows this exact order:

```
modules/<name>/
├── schemas/        # Mongoose schemas
├── dto/            # class-validator DTOs
├── enums/          # TypeScript enums (if needed)
├── types/          # interfaces (if needed)
├── <name>.service.ts
├── <name>.controller.ts
└── <name>.module.ts
```

### Module dependencies (import order matters)

```
AuthModule → (no deps on other feature modules)
UsersModule → (schema only, no module deps)
WorkspacesModule → AuthModule
ProjectsModule → WorkspacesModule
TasksModule → ProjectsModule, WorkspacesModule, ActivityModule, NotificationsModule
CommentsModule → TasksModule, ActivityModule, NotificationsModule
SprintsModule → ProjectsModule, WorkspacesModule, NotificationsModule (registers TaskSchema directly)
ActivityModule → (standalone, called by other services)
NotificationsModule → (standalone; registers User/Task/Project schemas directly to stay
                       importable by the modules that depend on it)
FilesModule → (standalone, registers TaskSchema directly)
SearchModule → (standalone, registers Task/Project/User schemas directly)
```

Rule: import the **module** when you need its **service**. Register the **schema** directly with `MongooseModule.forFeature()` when you only need raw model access and importing the module would create a circular dependency.

---

## Coding Conventions

### Path aliases — always use these, never relative imports across modules

```typescript
@config/*     → src/config/*
@common/*     → src/common/*
@modules/*    → src/modules/*
@database/*   → src/database/*
```

### Controllers

- Never put business logic in controllers
- Controllers only: receive request → call service → return result
- Always use `@CurrentUser()` decorator to get logged-in user, never `@Req()`
- Use `@HttpCode(HttpStatus.OK)` on POST endpoints that don't create resources

```typescript
// ✅ correct
@Get(':taskId')
findOne(@Param('taskId') taskId: string, @CurrentUser() user: UserDocument) {
  return this.tasksService.findOne(taskId, user);
}

// ❌ wrong — logic in controller
@Get(':taskId')
async findOne(@Param('taskId') taskId: string, @CurrentUser() user: UserDocument) {
  const task = await this.taskModel.findById(taskId);
  if (!task) throw new NotFoundException();
  return task;
}
```

### Services

- All business logic lives here
- Always validate ownership/membership before returning data
- Use `toObjectId(id)` from `@common/utils/object-id` before passing string IDs to MongoDB — it throws 400 automatically on invalid format
- Never return raw Mongoose documents with sensitive fields — strip them before returning

### DTOs

- Every request body must have a DTO with class-validator decorators
- Use `@IsOptional()` for partial update DTOs
- String fields always get `@MaxLength()`
- Enums always use `@IsEnum()`

```typescript
// ✅ correct update DTO pattern
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
```

### Schemas

- Always add `{ timestamps: true }` to `@Schema()`
- Add MongoDB indexes explicitly at the bottom of the schema file
- Fields that should not be returned by default use `select: false`
- Optional fields default to `null`, not `undefined`

```typescript
// ✅ correct schema pattern
@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true })
  title: string;

  @Prop({ default: null })
  description: string;

  @Prop({ required: true, select: false }) // hidden by default
  sensitiveField: string;
}

// indexes go at the bottom
TaskSchema.index({ projectId: 1, status: 1 });
```

### Error handling

- Use NestJS built-in exceptions — never throw raw `Error`
- `NotFoundException` → 404 — resource doesn't exist
- `ForbiddenException` → 403 — user lacks permission
- `UnauthorizedException` → 401 — not logged in / bad token
- `ConflictException` → 409 — duplicate (slug, email, etc.)
- `BadRequestException` → 400 — invalid input not caught by DTO

### Response shape

All responses are automatically wrapped by `TransformInterceptor`:

```json
// success
{ "success": true, "data": <payload> }

// error (from HttpExceptionFilter)
{ "success": false, "error": { "statusCode": 404, "message": "...", "path": "..." } }
```

Controllers just return plain objects — never manually wrap in `{ success, data }`.

### Auth & permissions

- All routes protected by `JwtAuthGuard` globally — no need to add it per route
- Use `@Public()` only on auth endpoints (login, register, forgot-password etc.)
- Permission checks live in the **service**, not the controller or guard
- Pattern: `findOne` → verify membership → verify role → do operation

```typescript
// ✅ correct permission check pattern in service
async deleteTask(taskId: string, user: UserDocument) {
  const task = await this.findOne(taskId, user);           // throws 404 if not found
  const workspace = await this.workspacesService.findOne(task.workspaceId, user); // throws 403 if not member
  this.workspacesService.assertRole(workspace, user, [WorkspaceRole.ADMIN]);      // throws 403 if wrong role
  await task.deleteOne();
}
```

---

## Notification Pipeline

Notifications never run on the request path. The flow is:

```
service call → NotificationsService.notify()   (producer: one queue.add, no Mongo, no socket)
             → BullMQ queue "notifications" in Redis
             → NotificationsProcessor           (worker: insertMany + unread count)
             → NotificationsGateway.pushNotification()
             → socket.io room `user:<id>`       (every tab that user has open)
```

Key points:

- **Producer**: `NotificationsService` is the only thing other modules touch. Its `notify*` helpers build the copy/link and enqueue; they never throw and they drop the actor from the recipient list by default (you are not notified about your own comment or status change). Events that *should* reach the actor pass `includeActor: true` — currently only `notifyTaskAssigned`, so assigning a task to yourself still notifies you (with "You assigned yourself a task" wording).
- **Worker**: `NotificationsProcessor` handles both job types — `create-notification` and `scan-due-tasks`. It is registered with `concurrency: 5` and runs inside the API process; moving it to a dedicated worker process means starting the same Nest app with only this module.
- **Idempotency**: jobs may carry a `dedupeKey`. The `(recipientId, dedupeKey)` unique partial index plus `insertMany({ ordered: false })` makes re-delivery a no-op, which is what lets the due-date scan re-run safely.
- **Scheduler**: `NotificationsScheduler` upserts a BullMQ job scheduler on boot (`*/15 * * * *`) that scans for tasks due within 24h / already overdue and queues `task_due_soon` / `task_overdue` notifications for their assignees. Upsert is idempotent, so restarting the API does not duplicate it.
- **Socket auth**: the gateway reads the `access_token` **cookie** off the handshake (`handshake.headers.cookie`) — the browser cannot put an HttpOnly cookie into `handshake.auth`. On rejection it emits `unauthorized` before disconnecting so the client can refresh its token and reconnect.
- **Events**: `notification:new` (`{ notification, unreadCount }`) and `notification:count` (`{ unreadCount }`). The unread count is always computed server-side — the client never derives the badge number itself.
- **Links**: `notification.link` is a **relative** SPA path built by `notification-links.ts`. Prefix it with `appUrl` if a link ever has to leave the app (emails).

---

## Key Patterns Already Implemented

### Fire-and-forget services

`ActivityService.log()` and `NotificationsService.notify()` both wrap their logic in try/catch internally and never throw to the caller. If MongoDB or Redis momentarily fails, the user's actual operation (e.g. updating a task) still succeeds. Never wrap calls to these in try/catch in the calling service — it's redundant, they already handle their own errors.

```typescript
// ✅ correct — no try/catch needed, log() handles its own errors
await this.activityService.log({ taskId, action: ActivityAction.STATUS_CHANGED, ... });

// ❌ unnecessary — log() never throws
try {
  await this.activityService.log({ ... });
} catch {}
```

### Pagination (use for all list endpoints)

```typescript
import { getPaginationParams, buildPaginationMeta } from '@common/utils/pagination';

async findAll(query: QueryDto, user: UserDocument) {
  const { skip, limit, page } = getPaginationParams(query);
  const [items, total] = await Promise.all([
    this.model.find(filter).skip(skip).limit(limit),
    this.model.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}
```

### ObjectId conversion (always use this)

```typescript
import { toObjectId } from '@common/utils/object-id';

// throws BadRequestException automatically if id is not a valid ObjectId
const task = await this.taskModel.findById(toObjectId(taskId));
```

### Config access (never use process.env directly)

```typescript
// ✅ inject AppConfigService
constructor(private config: AppConfigService) {}
this.config.jwtSecret

// ❌ never do this
process.env.JWT_SECRET
```

### Soft delete pattern

Nothing is permanently deleted immediately. Set `archivedAt` / `deletedAt` to `new Date()`, and all queries filter with `{ archivedAt: null }` or `{ deletedAt: null }`.

---

## Rate Limiting

Rate limiting is applied globally via `ThrottlerGuard` registered as `APP_GUARD` in `AppModule`. Three named tiers are defined in `src/config/throttler.config.ts`:

| Tier | TTL | Limit | Purpose |
|---|---|---|---|
| `default` | 60 s | 300 req | Applied to all routes automatically |
| `auth` | 60 s | 10 req | Brute-force protection on credential endpoints |
| `upload` | 1 h | 20 req | Expensive file-write operations |

### Import rule

Always import `Throttle` and `SkipThrottle` from `@common/decorators/throttle.decorator`, never directly from `@nestjs/throttler`:

```typescript
import { Throttle, SkipThrottle } from '@common/decorators/throttle.decorator';
```

### Applied overrides

| Controller / endpoint | Decorator | Reason |
|---|---|---|
| `AppController GET /health` | `@SkipThrottle()` | Docker healthcheck polls every 10 s — must never be rate limited or the container reports unhealthy |
| `AuthController POST /login` | `@Throttle({ auth: ... })` | Credential brute-force |
| `AuthController POST /register` | `@Throttle({ auth: ... })` | Account creation spam |
| `AuthController POST /forgot-password` | `@Throttle({ auth: ... })` | Email enumeration + spam |
| `AuthController POST /reset-password` | `@Throttle({ auth: ... })` | Token brute-force |
| `FilesController POST /files/upload` | `@Throttle({ upload: ... })` | MinIO write is expensive |

### Rule: `@SkipThrottle()` is mandatory on health / readiness endpoints

Any endpoint polled by Docker, Kubernetes, or a load-balancer health probe **must** have `@SkipThrottle()`. Forgetting it causes the container to be marked unhealthy and restarted under normal traffic.

---

## Docker Setup

The project runs fully in Docker with two separate modes — never mix files between them.

| File                      | Purpose                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`              | Multi-stage: `builder` → `development` → `production`                                                                   |
| `docker-compose.dev.yml`  | Dev mode — mounts `./src` as a volume, runs `npm run start:dev` inside the container for hot-reload                     |
| `docker-compose.prod.yml` | Prod mode — uses the compiled `dist/` from the `production` stage, no mounted source                                    |
| `.env.docker`             | Shared by both compose files. Uses Docker service names as hostnames (`mongo`, `redis`, `minio`) instead of `localhost` |
| `.env`                    | Used only when running the app directly with `npm run start:dev` outside Docker — uses `localhost`                      |

### Scripts (always use these instead of raw docker compose commands)

```bash
./scripts/dev.sh     # starts all 4 containers detached, auto-opens a new terminal tailing taskflow-api logs
./scripts/prod.sh    # starts all 4 containers detached in production mode, warns on placeholder JWT secrets
./scripts/stop.sh    # interactive — asks which mode to stop, never deletes named volumes
```

Do not suggest `docker compose up` directly when helping with this project — the scripts already wrap the correct flags (`--build`, `-d`, the right `-f` file) and include safety checks (Docker running, `.env.docker` exists). Modify the scripts themselves if new behavior is needed, rather than telling the user to bypass them.

### Key Docker facts to remember

- All 4 services (`taskflow-api`, `mongo`, `redis`, `minio`) have healthchecks. `docker compose ps` should show `(healthy)` next to all of them when working correctly.
- Named volumes (`mongo-data`, `redis-data`, `minio-data`) persist data across `docker compose down`. Only `docker compose down -v` wipes them — never suggest this casually.
- MinIO's `useSSL` is controlled by `MINIO_USE_SSL` env var, intentionally decoupled from `NODE_ENV` — do not tie MinIO SSL back to `isProduction`, this caused a real bug (`EPROTO wrong version number`) when they were coupled.
- The `development` Dockerfile stage does not copy `src/` — it's mounted at runtime by `docker-compose.dev.yml`. If you add new root-level config files that NestJS reads (e.g. a new `nest-cli.json`-like file), they need to be added to the `volumes:` list in `docker-compose.dev.yml` or the dev container won't see them.
- Email templates (`.hbs` files) are copied explicitly in the production Dockerfile stage since they're read from disk at runtime, not bundled by the NestJS compiler.

---

## Completed Modules

- ✅ Config
- ✅ Database
- ✅ Common (guards, decorators, filters, interceptors, utils)
- ✅ Auth (login, register via invite, refresh, forgot/reset password)
- ✅ Workspaces (CRUD + member management)
- ✅ Projects (CRUD + kanban status config + member management)
- ✅ Tasks (CRUD + bulk ops + filtering)
- ✅ Comments (task comments + @mentions)
- ✅ Sprints (sprint planning + burndown)
- ✅ Activity (audit log + integrated into tasks & comments)
- ✅ Notifications (BullMQ queue + worker, WebSocket push, due-date scanner, email service; integrated into tasks, comments, sprints & auth)
- ✅ Files (MinIO upload/download)
- ✅ Search (full-text search)
- ✅ Table Settings (per-user saved table view/page-size/column preferences, one doc per user+key)
- ✅ Sidebar Settings (per-user saved sidebar nav module visibility/order + collapsed state, one doc per user)
- ✅ Workspace Activity Log endpoint (`GET /workspaces/:workspaceId/activity`, filterable by user/module/action/date-range — powers the frontend's Activity Log page)
- ✅ Notifications table filters (`GET /notifications` extended with `isRead`/`type`/`dateFrom`/`dateTo`, alongside the existing `page`/`limit`/`unreadOnly` — powers the frontend's Notifications table page, same shape as the Activity Log's filter set)
- ✅ Docker (dev + prod compose, multi-stage Dockerfile, automation scripts)
- ✅ Swagger/OpenAPI (UI at /api/docs in development, all controllers + DTOs annotated)

## API Documentation

Swagger UI is available at **`/api/docs`** in development only (`NODE_ENV !== 'production'`). It is never mounted in production.

- **Auth**: The API uses HttpOnly cookie authentication, not Bearer tokens. Call `POST /api/v1/auth/login` first — two cookies are set automatically: `access_token` (15 min) and `refresh_token` (7 days, path-scoped to `/api/v1/auth/refresh`). Enable "withCredentials" in the Swagger UI options (already configured) so cookies are sent.
- **Security schemes**: Two cookie auth schemes are declared — `cookie-access-token` (all protected routes) and `cookie-refresh-token` (refresh endpoint only).
- **New endpoints**: Add `@ApiTags('GroupName')` to the controller, `@ApiOperation({ summary: '...' })` and `@ApiResponse()` to each handler, `@ApiProperty()` / `@ApiPropertyOptional()` to every DTO field, and `@ApiParam()` for route parameters. Follow the same pattern as existing controllers.

## Remaining Work

- ⬜ README.md run instructions — deferred until the frontend is feature-complete, do not add unprompted

## Workspaces Module Notes

- Workspace archiving is soft-delete (`archivedAt`), owner-only, via `DELETE /workspaces/:workspaceId`.
- `GET /workspaces/archived` and `PATCH /workspaces/:workspaceId/restore` (owner-only) support un-archiving — declared before `GET/PATCH :workspaceId` is fine here since `archived`/`restore` are distinct static segments, but note the general rule: any new static-path route under `/workspaces` must be declared **before** `:workspaceId`-based routes in the controller, or Nest will swallow it as a param match.
- `findMyWorkspaces` intentionally returns the full `members` array (no `.select('-members')`) so the frontend can compute member counts and per-workspace ownership without an extra request.

## Auth Module Notes

- Invite re-use for existing accounts: `POST /auth/register` rejects with 409 if the invited email already has an account. For that case, `GET /auth/invite/:token` also returns `userExists: boolean`, and an authenticated user can call `POST /auth/accept-invite` (body: `{ token }`) to just be added to the workspace instead of registering again. Keep this path in mind whenever the invite/register flow changes — a removed member being re-invited must go through `accept-invite`, not `register`.

## Tasks Module Notes

- `GET /workspaces/:workspaceId/my-tasks` (`my-tasks.controller.ts`) lists the current user's tasks **across every project in the workspace**, paginated — separate from the per-project `GET /workspaces/:workspaceId/projects/:projectId/tasks`. It queries `TasksQueryService.findMyTasks()` directly by the `{ workspaceId, assigneeId }` compound index on `Task` rather than looking up projects first, so it stays a single query regardless of how many projects the workspace has.
- Its `status` filter is a case-insensitive partial match (`$regex`, escaped), not exact — project status columns aren't a fixed enum, so an exact match would be unusable when filtering across projects with different column names.

## Table Settings Module Notes

- One document per `{ userId, key }` pair (unique index) — `key` is an arbitrary string identifying which table the settings belong to. Three in use so far: `"myTasks"`, `"activityLog"`, `"notifications"`. Reuse the same collection for future customizable tables (a new `key`) rather than adding a new one — this is exactly what it's for.
- `PUT /table-settings/:key` is an upsert (`findOneAndUpdate` with `upsert: true`) — the frontend calls it on every preference change (view style, page size, column visibility/order), so there is no separate create endpoint.
- `columns` is stored as an ordered array of `{ id, visible, width }` — array order **is** the display order the frontend renders columns in; there's no separate `order` field. `width` is the saved pixel width from the frontend's column-resize mode; `null`/omitted means "use that view's default width".
- The `TableColumnSetting` subdocument schema field is named `columnId`, not `id` — see the NOTE comment on it in `schemas/table-settings.schema.ts`. Mongoose subdocuments auto-add a virtual `id` getter/setter derived from `_id`; a real path also named `id` collides with it and silently never persists (only an auto-generated `_id` survives). `TableSettingsService.toResponse()` maps `columnId` back to `id` at the API boundary so the wire format is unaffected — if you add more subdocument fields here, avoid `id` as a name for the same reason.

## Activity Module Notes (workspace-wide feed)

- `WorkspaceActivityController` (`workspace-activity.controller.ts`) is separate from `ActivityController` — same `ActivityService`/`ActivityLog` schema, different base path (`workspaces/:workspaceId/activity`, not nested under a project/task) and a different query shape (`ActivityService.findByWorkspace()`).
- `ActivityLog` has a real, stored `module` field (enum, `ACTIVITY_MODULES` from `activity/utils/activity-module.util.ts` — 6 buckets: `task`, `comments`, `attachments`, `sprint`, `checklist`, `watchers`). It's set once at write time by `ActivityService.log()` via `getActivityModule(params.action)` — callers never pass it explicitly, so every existing `activityService.log({...})` call site kept working unmodified. Filtering by `module` in `findByWorkspace()` is therefore a plain indexed equality match (`{ workspaceId, module, createdAt: -1 }` index), not an `action: { $in: [...] }` expansion; if both `module` and `action` query params are given, both filters apply (AND). The frontend just reads `log.module` straight off the response now (it used to derive it client-side from `action` — that fallback logic still exists in `features/activity/utils/activityMeta.ts` but is unused for this) — keep the backend util's grouping in sync when adding a new `ActivityAction`, or the schema's `enum: ACTIVITY_MODULES` will reject writes for it.
- `findByWorkspace()` also populates `taskId` (title only) and `projectId` (name only) alongside the usual `actorId` (name/email/avatarUrl), so the frontend table/drawer can show context without extra requests.
- No `LOGIN`/`RESTORE` actions exist in the backend enum yet — the frontend's action→color/icon category mapping (create/update/delete/restore/login) still defines buckets for them since the reference design called for 5 categories; they're just currently unreachable until a login-activity or restore-activity is logged somewhere.
- `ActivityLog` also stores request metadata captured at write time: `ip`, `browser`, `os`, `device` (all nullable strings). Populated by `ActivityService.log()` from two sources — see `common/context/request-context.ts` and `common/middleware/request-context.middleware.ts`:
  - `RequestContextMiddleware` is registered globally (`AppModule.configure()`, `forRoutes('*')`) and stashes each request's IP (`X-Forwarded-For`'s first hop, falling back to `req.ip`) and raw `User-Agent` header into an `AsyncLocalStorage` (`requestContext`) for the duration of that request's async context.
  - `ActivityService.log()` reads `requestContext.get()` and parses the User-Agent with `ua-parser-js` (`UAParser(userAgent)`) into separate `browser`/`os`/`device` strings via private `formatBrowser`/`formatOs`/`formatDevice` helpers — this is why call sites never had to change to pass this data explicitly, same as `module`.
  - All four fields are `null` if activity is ever logged outside an HTTP request (no current caller does this, but nothing enforces it can't happen) or if the middleware didn't run for some reason.

## Notifications Table Filters Notes

- `NotificationsController.findAll` / `NotificationsService.findForUser` now take a query object (`page`, `limit`, `unreadOnly`, `isRead`, `type`, `dateFrom`, `dateTo`) instead of positional args — added for the frontend's Notifications table page. `isRead` (explicit `true`/`false`) takes precedence over the older `unreadOnly` boolean when both are present; the bell panel still calls the endpoint with neither, the table page always sends `isRead` (or omits it for "all").
- `dateFrom`/`dateTo` filter on `createdAt` with `$gte`/`$lte`, same convention as the workspace Activity Log's date-range filter.

## Sidebar Settings Module Notes

- One document per `userId` (unique index, singular resource) — unlike Table Settings there's no `key`, since there's only one sidebar. `GET/PUT /sidebar-settings` (no path param), scoped to `CurrentUser()`.
- `modules` is stored the same way as `table-settings.columns`: an ordered array of `{ id, visible }`, array order **is** the sidebar's render order. The subdocument field is `moduleId`, not `id` — same Mongoose virtual-`id` collision as `TableColumnSetting` (see above), avoided the same way (`@Schema({ id: false })` + boundary mapping in `SidebarSettingsService.toResponse()`).
- `collapsed` is a plain boolean on the top-level document, saved immediately on toggle (not batched — there's nothing to batch for a single flag).
- Frontend merges saved `modules` with a hardcoded default list (`normalizeSidebarModules` in `AppLayout.tsx`) so a module added to the app after a user already saved settings still appears, appended at the end.

---

## Running the Project

Always prefer the scripts over raw commands:

```bash
./scripts/dev.sh      # daily development — hot-reload, logs auto-open in new terminal
./scripts/prod.sh     # test production-style build
./scripts/stop.sh     # stop containers (asks which mode)
```

### Seeding the database

The seed script must run **inside** the dev container — `mongo` only resolves within the Docker network:

```bash
docker exec -it taskflow-api-dev npm run seed:docker
```

Never run `npm run seed:docker` directly on the host — it will fail with `EAI_AGAIN mongo` because the `mongo` hostname isn't reachable outside Docker. Use `npm run seed` (no `:docker`) only when running the app outside Docker with a `localhost` connection in `.env`.

---

Direct (non-Docker) commands are also available but only relevant when explicitly debugging outside Docker:

```bash
npm run start:dev     # development with watch mode, uses .env (localhost)
npm run build         # production build
npm run lint          # ESLint
```

## Environment

All env vars are validated at startup via Joi in `src/config/validation.schema.ts`.
App will refuse to start if any required variable is missing.
Two env files exist — `.env` (local, non-Docker) and `.env.docker` (Docker, both dev and prod compose). Never commit either — both are gitignored.
