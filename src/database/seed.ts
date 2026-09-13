import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────
// Load .env file — supports both local (.env) and Docker (.env.docker)
// Usage:
//   npm run seed              → uses .env (local dev)
//   npm run seed:docker       → uses .env.docker (Docker dev)
// ─────────────────────────────────────────────────────────────────
const envFile = process.env.SEED_ENV === 'docker' ? '.env.docker' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const DATABASE_URI = process.env.DATABASE_URI as string;

if (!DATABASE_URI) {
  console.error('❌ DATABASE_URI not found in env file. Aborting.');
  process.exit(1);
}

// ─── Small deterministic-ish random helpers ──────────────────────
// Not cryptographic — just enough variety to make a demo dashboard look
// like a team has actually been using the product for a while.
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(randomInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}
// A date `daysOffset` days from now (negative = past), at a given hour.
function atDaysOffset(daysOffset: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, randomInt(0, 59), 0, 0);
  return d;
}

// ─── Minimal inline schemas ──────────────────────────────────────
// We don't import from src/ to keep the script self-contained and
// avoid TypeScript compilation issues at runtime with ts-node.
// Field names/enums mirror the real schemas exactly (see each module's
// schemas/*.schema.ts) so the seeded data is readable by the real API —
// keep these two in sync if the real schemas change.

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    logoUrl: { type: String, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const projectSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    name: { type: String, required: true },
    key: { type: String, required: true, uppercase: true },
    description: { type: String, default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    statuses: [
      {
        name: { type: String },
        color: { type: String },
        order: { type: Number },
        wipLimit: { type: Number, default: null },
      },
    ],
    sprintMode: { type: Boolean, default: false },
    color: { type: String, default: '#3B82F6' },
    icon: { type: String, default: null },
    taskCounter: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const taskSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    taskNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, required: true },
    priority: { type: String, default: 'medium' },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date, default: null },
    labels: { type: [String], default: [] },
    storyPoints: { type: Number, default: null },
    order: { type: Number, default: 0 },
    sprintId: { type: mongoose.Schema.Types.ObjectId, default: null },
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    attachments: { type: [], default: [] },
    checklist: {
      type: [
        {
          title: { type: String, required: true },
          completed: { type: Boolean, default: false },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    links: { type: [], default: [] },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const sprintSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    name: { type: String, required: true },
    goal: { type: String, default: null },
    status: { type: String, required: true, default: 'planned' }, // planned | active | completed
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    totalPoints: { type: Number, default: null },
    completedPoints: { type: Number, default: null },
  },
  { timestamps: true },
);

const commentSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    body: { type: String, required: true },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, required: true },
    titleKey: { type: String, required: true },
    titleParams: { type: Object, default: {} },
    bodyKey: { type: String, required: true },
    bodyParams: { type: Object, default: {} },
    link: { type: String, default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const activityLogSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    module: { type: String, required: true },
    field: { type: String, default: null },
    oldValue: { type: Object, default: null },
    newValue: { type: Object, default: null },
    meta: { type: String, default: null },
    ip: { type: String, default: null },
    browser: { type: String, default: null },
    os: { type: String, default: null },
    device: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// ─── Seed data — users ────────────────────────────────────────────
// Only the first user's credentials are documented in the README as the
// public demo login; the rest exist so the dashboard has more than one
// person to spread work/activity across (workload chart, assignees, etc.).
const SEED_USERS = [
  { name: 'Anar Talibov', email: 'anar@taskflow.dev' },
  { name: 'Sara Mammadova', email: 'sara@taskflow.dev' },
  { name: 'Elvin Huseynov', email: 'elvin@taskflow.dev' },
  { name: 'Leyla Aliyeva', email: 'leyla@taskflow.dev' },
  { name: 'Rashad Karimov', email: 'rashad@taskflow.dev' },
];
const SEED_PASSWORD = 'Test1234!';

const SEED_WORKSPACE = {
  name: 'TaskFlow Dev',
  slug: 'taskflow-dev',
  description: 'Development workspace for testing',
};

const PRIORITIES = ['critical', 'high', 'medium', 'low'];

const SEED_PROJECTS = [
  {
    name: 'Frontend Development',
    key: 'FE',
    description: 'Building the TaskFlow frontend',
    sprintMode: true,
    color: '#3B82F6',
    statuses: [
      { name: 'To Do', color: '#6B7280', order: 0, wipLimit: null },
      { name: 'In Progress', color: '#3B82F6', order: 1, wipLimit: null },
      { name: 'In Review', color: '#F59E0B', order: 2, wipLimit: null },
      { name: 'Done', color: '#10B981', order: 3, wipLimit: null },
    ],
    taskTitles: [
      'Set up React project with Vite and TypeScript',
      'Configure Axios instance with cookie credentials',
      'Build login and registration pages',
      'Implement JWT refresh token interceptor',
      'Build workspace dashboard layout',
      'Build kanban board with drag-and-drop',
      'Build task detail modal',
      'Implement real-time notifications via WebSocket',
      'Build sprint planning board',
      'Implement global search (Cmd+K)',
      'Add dark mode theme support',
      'Build activity log page',
      'Build notifications table page',
      'Add column customization to My Tasks',
      'Implement file upload drag-and-drop',
      'Add avatar upload to settings page',
      'Build workspace members management page',
      'Add i18n support (en/az/ru)',
      'Optimize dashboard chart re-renders',
      'Fix Safari date picker rendering bug',
      'Add keyboard shortcuts for board navigation',
      'Write unit tests for auth flow',
    ],
  },
  {
    name: 'Platform Backend',
    key: 'BE',
    description: 'Core API, infrastructure and platform services',
    sprintMode: false,
    color: '#10B981',
    statuses: [
      { name: 'Backlog', color: '#6B7280', order: 0, wipLimit: null },
      { name: 'In Progress', color: '#3B82F6', order: 1, wipLimit: null },
      { name: 'Testing', color: '#F59E0B', order: 2, wipLimit: null },
      { name: 'Done', color: '#10B981', order: 3, wipLimit: null },
    ],
    taskTitles: [
      'Design MongoDB schema for tasks and projects',
      'Implement JWT auth with refresh tokens',
      'Build streaming file upload pipeline to MinIO',
      'Set up BullMQ notification queue',
      'Add rate limiting to auth endpoints',
      'Write dashboard aggregation pipelines',
      'Add workspace activity audit log',
      'Set up Docker Compose for production',
      'Configure Nginx reverse proxy with SSL',
      'Add health check endpoint',
      'Write API documentation with Swagger',
      'Set up automated demo data reset job',
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────
async function seed() {
  console.log('');
  console.log('🌱 TaskFlow Seed Script');
  console.log(`📁 Using env file: ${envFile}`);
  console.log(`🔗 Connecting to: ${DATABASE_URI}`);
  console.log('');

  await mongoose.connect(DATABASE_URI, { dbName: 'taskflow' });
  console.log('✅ Connected to MongoDB');

  const User = mongoose.model('User', userSchema);
  const Workspace = mongoose.model('Workspace', workspaceSchema);
  const Project = mongoose.model('Project', projectSchema);
  const Task = mongoose.model('Task', taskSchema);
  const Sprint = mongoose.model('Sprint', sprintSchema);
  const Comment = mongoose.model('Comment', commentSchema);
  const Notification = mongoose.model('Notification', notificationSchema);
  const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

  // ─── Clear existing seed data ─────────────────────────────────
  // Always runs, regardless of whether a seed user currently exists — a
  // workspace/project can be left behind (and re-running would collide on
  // the unique slug/key) even if its owning user was removed separately, or
  // by an older version of this script. Every step below is a no-op if
  // nothing matches, so this is safe to run against an already-empty DB.
  console.log('🧹 Clearing any previous seed data...');
  const existingWorkspace = await Workspace.findOne({
    slug: SEED_WORKSPACE.slug,
  });
  if (existingWorkspace) {
    const existingProjects = await Project.find({
      workspaceId: existingWorkspace._id,
    });
    const projectIds = existingProjects.map((p) => p._id);
    await Comment.deleteMany({ projectId: { $in: projectIds } });
    await Task.deleteMany({ projectId: { $in: projectIds } });
    await Sprint.deleteMany({ projectId: { $in: projectIds } });
    await Project.deleteMany({ _id: { $in: projectIds } });
    await ActivityLog.deleteMany({ workspaceId: existingWorkspace._id });
    await Notification.deleteMany({ workspaceId: existingWorkspace._id });
    await Workspace.deleteOne({ _id: existingWorkspace._id });
  }
  await User.deleteMany({ email: { $in: SEED_USERS.map((u) => u.email) } });
  console.log('   Cleared. Seeding fresh data...');
  console.log('');

  // ─── Create users ────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);
  const users = await User.insertMany(
    SEED_USERS.map((u) => ({
      name: u.name,
      email: u.email,
      password: hashedPassword,
    })),
  );
  const [anar, sara, elvin, leyla, rashad] = users;
  console.log(`✅ ${users.length} users created`);

  // ─── Create workspace ────────────────────────────────────────
  const workspace = await Workspace.create({
    name: SEED_WORKSPACE.name,
    slug: SEED_WORKSPACE.slug,
    description: SEED_WORKSPACE.description,
    ownerId: anar._id,
    members: [
      { userId: anar._id, role: 'owner', joinedAt: atDaysOffset(-90) },
      { userId: sara._id, role: 'admin', joinedAt: atDaysOffset(-85) },
      { userId: elvin._id, role: 'member', joinedAt: atDaysOffset(-80) },
      { userId: leyla._id, role: 'member', joinedAt: atDaysOffset(-70) },
      { userId: rashad._id, role: 'member', joinedAt: atDaysOffset(-60) },
    ],
  });
  console.log(`✅ Workspace created: ${workspace.name} (${workspace.slug})`);

  // ─── Create projects + tasks ────────────────────────────────────
  // Tracked across both projects for the activity log / notifications
  // that reference "some task" or "some project" further down.
  const allTasks: any[] = [];
  const allProjects: any[] = [];
  let activeSprint: any = null;

  for (const projDef of SEED_PROJECTS) {
    const project = await Project.create({
      workspaceId: workspace._id,
      name: projDef.name,
      key: projDef.key,
      description: projDef.description,
      ownerId: anar._id,
      statuses: projDef.statuses,
      sprintMode: projDef.sprintMode,
      color: projDef.color,
      taskCounter: projDef.taskTitles.length,
      members: users.map((u, i) => ({
        userId: u._id,
        role: i === 0 ? 'owner' : 'member',
        joinedAt: atDaysOffset(-80 + i * 2),
      })),
    });
    allProjects.push(project);
    console.log(`✅ Project created: ${project.name} (${project.key})`);

    // One active sprint, only in the first sprint-enabled project.
    let sprint: any = null;
    if (projDef.sprintMode && !activeSprint) {
      sprint = await Sprint.create({
        projectId: project._id,
        workspaceId: workspace._id,
        name: 'Sprint 4',
        goal: 'Ship real-time notifications and the customizable dashboard',
        status: 'active',
        startDate: atDaysOffset(-9),
        endDate: atDaysOffset(5),
      });
      activeSprint = sprint;
      console.log(`✅ Active sprint created: ${sprint.name}`);
    }

    const doneStatus = projDef.statuses[projDef.statuses.length - 1].name; // "Done"
    const nonDoneStatuses = projDef.statuses
      .slice(0, -1)
      .map((s) => s.name);

    let mineOpenCount = 0; // deterministically seeds a few overdue/due-soon tasks for anar

    const taskDocs = projDef.taskTitles.map((title, i) => {
      const isDone = i < Math.round(projDef.taskTitles.length * 0.35);
      const status = isDone ? doneStatus : pick(nonDoneStatuses);
      const assignee = pick(users);
      const isMine = i % 4 === 0; // guarantee anar has a handful of open tasks
      const assigneeId = isMine ? anar._id : assignee._id;
      if (isMine && !isDone) mineOpenCount++;

      // Due dates: a mix of overdue, due-soon, far-future and none — only
      // for tasks that aren't done (a done task's due date doesn't matter
      // for the KPIs/widgets that read it). The dashboard's "My Tasks"
      // widget only shows tasks assigned to the demo user that are already
      // due (dueDate <= today) — force the first couple of anar's own open
      // tasks into that bucket deterministically, or it's populated only by
      // chance and the widget looks empty on an unlucky seed run.
      let dueDate: Date | null = null;
      if (!isDone) {
        if (isMine && mineOpenCount <= 2) {
          dueDate = atDaysOffset(-randomInt(1, 5)); // overdue, guaranteed
        } else if (isMine && mineOpenCount <= 4) {
          dueDate = atDaysOffset(randomInt(0, 2)); // due today/very soon, guaranteed
        } else {
          const bucket = randomInt(0, 9);
          if (bucket <= 1) dueDate = atDaysOffset(-randomInt(1, 5)); // overdue
          else if (bucket <= 4) dueDate = atDaysOffset(randomInt(1, 6)); // due soon
          else if (bucket <= 6) dueDate = atDaysOffset(randomInt(10, 30)); // later
          // else: no due date
        }
      }

      // Done tasks get their "completed" updatedAt spread across the last
      // 7 days, so the productivity trend chart and "completed this month"
      // KPI both have real numbers instead of zeros.
      const createdAt = atDaysOffset(-randomInt(15, 60));
      const updatedAt = isDone ? atDaysOffset(-randomInt(0, 6)) : createdAt;

      // Spread sprint membership across the whole task list (every 3rd
      // task), not just the first N — those happen to be exactly the
      // "done" tasks (see isDone above), which would make the sprint
      // progress widget show a meaningless 100%.
      const inSprint = sprint && projDef.sprintMode && i % 3 === 0;

      const checklist =
        i % 5 === 0
          ? [
              { title: 'Write tests', completed: isDone },
              { title: 'Update docs', completed: isDone || Math.random() > 0.5 },
              { title: 'Get code review', completed: isDone },
            ]
          : [];

      return {
        projectId: project._id,
        workspaceId: workspace._id,
        taskNumber: i + 1,
        title,
        status,
        priority: isDone ? pick(PRIORITIES) : pick(PRIORITIES),
        storyPoints: pick([1, 2, 3, 5, 8]),
        reporterId: anar._id,
        assigneeId,
        watchers: [assigneeId, anar._id].filter(
          (v, idx, arr) => arr.indexOf(v) === idx,
        ),
        order: i,
        dueDate,
        sprintId: inSprint ? sprint._id : null,
        checklist,
        createdAt,
        updatedAt,
      };
    });

    const inserted = await Task.insertMany(taskDocs);
    allTasks.push(...inserted);
    console.log(`✅ ${inserted.length} tasks created in ${project.key}`);
  }

  // ─── Comments (on a handful of tasks, for realism) ───────────────
  const commentedTasks = pickN(allTasks, 8);
  const commentBodies = [
    'Looks good, one small nit on the naming.',
    'Can we double check this against the design spec?',
    "I'll pick this up after the sprint review.",
    'Blocked on the API contract being finalized.',
    'Nice work — tested locally, all green.',
    'This needs a rebase on main before merging.',
    "Let's sync on this tomorrow, a few questions.",
    'Updated the PR based on feedback, ready for another look.',
  ];
  let commentCount = 0;
  for (const task of commentedTasks) {
    const numComments = randomInt(1, 3);
    for (let i = 0; i < numComments; i++) {
      const author = pick(users);
      await Comment.create({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: workspace._id,
        authorId: author._id,
        body: pick(commentBodies),
        createdAt: atDaysOffset(-randomInt(0, 20)),
      });
      commentCount++;
    }
  }
  console.log(`✅ ${commentCount} comments created`);

  // ─── Notifications for the demo user (anar) ──────────────────────
  const notificationDefs: Array<{
    type: string;
    titleKey: string;
    bodyKey: string;
    titleParams: Record<string, string | number>;
    bodyParams: Record<string, string | number>;
    daysAgo: number;
    actorId: any;
    taskId: any;
    projectId: any;
  }> = [];

  for (let i = 0; i < 16; i++) {
    const task = pick(allTasks);
    const actor = pick(users.filter((u) => u._id !== anar._id));
    const kind = pick([
      'taskAssigned',
      'taskStatusChanged',
      'commentAdded',
      'commentMention',
      'taskDueSoon',
      'taskOverdue',
    ]);
    const project = allProjects.find(
      (p) => String(p._id) === String(task.projectId),
    );
    const taskKey = `${project.key}-${task.taskNumber}`;
    const common = { actorId: actor._id, taskId: task._id, projectId: task.projectId };

    if (kind === 'taskAssigned') {
      notificationDefs.push({
        ...common,
        type: 'task_assigned',
        titleKey: 'taskAssigned',
        bodyKey: 'taskAssigned',
        titleParams: { actorName: actor.name },
        bodyParams: { taskKey, taskTitle: task.title },
        daysAgo: randomInt(0, 10),
      });
    } else if (kind === 'taskStatusChanged') {
      notificationDefs.push({
        ...common,
        type: 'task_status_changed',
        titleKey: 'taskStatusChanged',
        bodyKey: 'taskStatusChanged',
        titleParams: { actorName: actor.name, taskKey, newStatus: task.status },
        bodyParams: { taskTitle: task.title, oldStatus: 'To Do', newStatus: task.status },
        daysAgo: randomInt(0, 10),
      });
    } else if (kind === 'commentAdded') {
      notificationDefs.push({
        ...common,
        type: 'comment_added',
        titleKey: 'commentAdded',
        bodyKey: 'commentAdded',
        titleParams: { actorName: actor.name, taskKey },
        bodyParams: { commentSnippet: pick(commentBodies) },
        daysAgo: randomInt(0, 10),
      });
    } else if (kind === 'commentMention') {
      notificationDefs.push({
        ...common,
        type: 'comment_mention',
        titleKey: 'commentMention',
        bodyKey: 'commentMention',
        titleParams: { actorName: actor.name },
        bodyParams: { taskKey, commentSnippet: '@anar can you take a look?' },
        daysAgo: randomInt(0, 10),
      });
    } else if (kind === 'taskDueSoon') {
      notificationDefs.push({
        ...common,
        type: 'task_due_soon',
        titleKey: 'taskDueSoon',
        bodyKey: 'taskDueOrOverdueBody',
        titleParams: { taskKey, hours: 24 },
        bodyParams: { taskTitle: task.title },
        daysAgo: randomInt(0, 3),
      });
    } else {
      notificationDefs.push({
        ...common,
        type: 'task_overdue',
        titleKey: 'taskOverdue',
        bodyKey: 'taskDueOrOverdueBody',
        titleParams: { taskKey },
        bodyParams: { taskTitle: task.title },
        daysAgo: randomInt(0, 3),
      });
    }
  }

  const notificationDocs = notificationDefs.map((n, i) => {
    const isRead = i >= 5; // first 5 stay unread
    const createdAt = atDaysOffset(-n.daysAgo);
    return {
      recipientId: anar._id,
      actorId: n.actorId,
      type: n.type,
      titleKey: n.titleKey,
      titleParams: n.titleParams,
      bodyKey: n.bodyKey,
      bodyParams: n.bodyParams,
      link: null,
      taskId: n.taskId,
      projectId: n.projectId,
      workspaceId: workspace._id,
      isRead,
      readAt: isRead ? atDaysOffset(-n.daysAgo + 1) : null,
      createdAt,
    };
  });
  await Notification.insertMany(notificationDocs);
  console.log(
    `✅ ${notificationDocs.length} notifications created (5 unread)`,
  );

  // ─── Activity log ─────────────────────────────────────────────
  // Two passes: a denser one over the last 7 days (so the dashboard's
  // Recent Activity widget and productivity trend both have real recent
  // entries), and a sparser one spread over ~10 weeks (so the 53-week
  // activity heatmap isn't just a single dark column).
  const recentActions = [
    'task_created',
    'status_changed',
    'priority_changed',
    'assignee_changed',
    'comment_added',
    'attachment_added',
    'checklist_item_completed',
  ];
  const actionModule: Record<string, string> = {
    task_created: 'task',
    task_updated: 'task',
    status_changed: 'task',
    priority_changed: 'task',
    assignee_changed: 'task',
    due_date_changed: 'task',
    comment_added: 'comments',
    attachment_added: 'attachments',
    checklist_item_completed: 'checklist',
    added_to_sprint: 'sprint',
  };

  const activityDocs: any[] = [];

  // Recent 7 days — several per day.
  for (let d = 0; d < 7; d++) {
    const countThatDay = randomInt(2, 6);
    for (let i = 0; i < countThatDay; i++) {
      const task = pick(allTasks);
      const actor = pick(users);
      const action = pick(recentActions);
      activityDocs.push({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: workspace._id,
        actorId: actor._id,
        action,
        module: actionModule[action],
        meta: action === 'comment_added' ? pick(commentBodies) : null,
        createdAt: atDaysOffset(-d, randomInt(8, 19)),
      });
    }
  }

  // ~10 weeks back — sparser, occasional gaps, for heatmap texture.
  for (let d = 8; d < 70; d++) {
    if (Math.random() < 0.35) continue; // some quiet days
    const countThatDay = randomInt(1, 4);
    for (let i = 0; i < countThatDay; i++) {
      const task = pick(allTasks);
      const actor = pick(users);
      const action = pick(recentActions);
      activityDocs.push({
        taskId: task._id,
        projectId: task.projectId,
        workspaceId: workspace._id,
        actorId: actor._id,
        action,
        module: actionModule[action],
        meta: action === 'comment_added' ? pick(commentBodies) : null,
        createdAt: atDaysOffset(-d, randomInt(8, 19)),
      });
    }
  }

  await ActivityLog.insertMany(activityDocs);
  console.log(`✅ ${activityDocs.length} activity log entries created`);

  // ─── Summary ─────────────────────────────────────────────────
  console.log('');
  console.log('─────────────────────────────────────');
  console.log('🎉 Seed complete! Use these credentials:');
  console.log('');
  console.log(`   Email:    ${SEED_USERS[0].email}`);
  console.log(`   Password: ${SEED_PASSWORD}`);
  console.log('');
  console.log(`   Workspace: ${SEED_WORKSPACE.name}`);
  console.log(`   Slug:      ${SEED_WORKSPACE.slug}`);
  console.log(
    `   Projects:  ${SEED_PROJECTS.map((p) => `${p.name} (${p.key})`).join(', ')}`,
  );
  console.log('─────────────────────────────────────');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
