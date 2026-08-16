# TaskFlow — Backend (NestJS)

## Project Overview

Internal task management application. NestJS + MongoDB + Redis backend.
REST API with JWT authentication (HttpOnly cookies), WebSockets for real-time updates.

---

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: MongoDB via Mongoose
- **Cache / Queue**: Redis + Bull
- **Auth**: JWT (access token 15min, refresh token 7d) via Passport
- **Real-time**: Socket.io
- **File storage**: MinIO (S3-compatible)
- **Email**: Nodemailer + Handlebars templates
- **Validation**: class-validator + class-transformer
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
SprintsModule → ProjectsModule, WorkspacesModule (registers TaskSchema directly)
ActivityModule → (standalone, called by other services)
NotificationsModule → (standalone, called by other services)
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

## Key Patterns Already Implemented

### Fire-and-forget services

`ActivityService.log()` and `NotificationsService.notify()` both wrap their logic in try/catch internally and never throw to the caller. If MongoDB or email momentarily fails, the user's actual operation (e.g. updating a task) still succeeds. Never wrap calls to these in try/catch in the calling service — it's redundant, they already handle their own errors.

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
- ✅ Notifications (in-app + email + WebSocket push + integrated into tasks, comments & auth)
- ✅ Files (MinIO upload/download)
- ✅ Search (full-text search)
- ✅ Table Settings (per-user saved table view/page-size/column preferences, one doc per user+key)
- ✅ Sidebar Settings (per-user saved sidebar nav module visibility/order + collapsed state, one doc per user)
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

- One document per `{ userId, key }` pair (unique index) — `key` is an arbitrary string identifying which table the settings belong to (currently only `"myTasks"` is used by the frontend). Reuse the same collection for future customizable tables rather than adding a new one.
- `PUT /table-settings/:key` is an upsert (`findOneAndUpdate` with `upsert: true`) — the frontend calls it on every preference change (view style, page size, column visibility/order), so there is no separate create endpoint.
- `columns` is stored as an ordered array of `{ id, visible, width }` — array order **is** the display order the frontend renders columns in; there's no separate `order` field. `width` is the saved pixel width from the frontend's column-resize mode; `null`/omitted means "use that view's default width".
- The `TableColumnSetting` subdocument schema field is named `columnId`, not `id` — see the NOTE comment on it in `schemas/table-settings.schema.ts`. Mongoose subdocuments auto-add a virtual `id` getter/setter derived from `_id`; a real path also named `id` collides with it and silently never persists (only an auto-generated `_id` survives). `TableSettingsService.toResponse()` maps `columnId` back to `id` at the API boundary so the wire format is unaffected — if you add more subdocument fields here, avoid `id` as a name for the same reason.

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
