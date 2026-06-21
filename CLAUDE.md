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
    └── search/           # full-text search

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
- ✅ Docker (dev + prod compose, multi-stage Dockerfile, automation scripts)

## Remaining Work

- ⬜ Frontend (React + TypeScript) — not started
- ⬜ README.md run instructions — deferred until frontend exists, do not add unprompted

---

## Running the Project

Always prefer the scripts over raw commands:

```bash
./scripts/dev.sh      # daily development — hot-reload, logs auto-open in new terminal
./scripts/prod.sh     # test production-style build
./scripts/stop.sh     # stop containers (asks which mode)
```

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
