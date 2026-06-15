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
TasksModule → ProjectsModule, WorkspacesModule
CommentsModule → TasksModule
SprintsModule → ProjectsModule, TasksModule
ActivityModule → (standalone, called by other services)
NotificationsModule → (standalone)
FilesModule → (standalone)
SearchModule → (standalone)
```

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

## Remaining Modules

All modules completed. 🎉

---

## Running the Project

```bash
npm run start:dev     # development with watch mode
npm run build         # production build
npm run lint          # ESLint
```

## Environment

All env vars are validated at startup via Joi in `src/config/validation.schema.ts`.
App will refuse to start if any required variable is missing.
See `.env` for all required variables.
