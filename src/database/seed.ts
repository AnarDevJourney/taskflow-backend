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

// ─── Minimal inline schemas ──────────────────────────────────────
// We don't import from src/ to keep the script self-contained and
// avoid TypeScript compilation issues at runtime with ts-node.

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
    checklist: { type: [], default: [] },
    links: { type: [], default: [] },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ─── Seed data ────────────────────────────────────────────────────
const SEED_USER = {
  name: 'Anar Talibov',
  email: 'anar@taskflow.dev',
  password: 'Test1234!',
};

const SEED_WORKSPACE = {
  name: 'TaskFlow Dev',
  slug: 'taskflow-dev',
  description: 'Development workspace for testing',
};

const SEED_PROJECT = {
  name: 'Frontend Development',
  key: 'FE',
  description: 'Building the TaskFlow frontend',
  statuses: [
    { name: 'To Do', color: '#6B7280', order: 0, wipLimit: null },
    { name: 'In Progress', color: '#3B82F6', order: 1, wipLimit: null },
    { name: 'In Review', color: '#F59E0B', order: 2, wipLimit: null },
    { name: 'Done', color: '#10B981', order: 3, wipLimit: null },
  ],
};

const SEED_TASKS = [
  {
    title: 'Set up React project with Vite and TypeScript',
    status: 'Done',
    priority: 'high',
    storyPoints: 2,
  },
  {
    title: 'Configure Axios instance with cookie credentials',
    status: 'Done',
    priority: 'high',
    storyPoints: 1,
  },
  {
    title: 'Build login and registration pages',
    status: 'In Progress',
    priority: 'high',
    storyPoints: 5,
  },
  {
    title: 'Implement JWT refresh token interceptor',
    status: 'In Progress',
    priority: 'high',
    storyPoints: 3,
  },
  {
    title: 'Build workspace dashboard layout',
    status: 'To Do',
    priority: 'high',
    storyPoints: 5,
  },
  {
    title: 'Build kanban board with drag-and-drop',
    status: 'To Do',
    priority: 'high',
    storyPoints: 8,
  },
  {
    title: 'Build task detail modal',
    status: 'To Do',
    priority: 'medium',
    storyPoints: 5,
  },
  {
    title: 'Implement real-time notifications via WebSocket',
    status: 'To Do',
    priority: 'medium',
    storyPoints: 5,
  },
  {
    title: 'Build sprint planning board',
    status: 'To Do',
    priority: 'medium',
    storyPoints: 5,
  },
  {
    title: 'Implement global search (Cmd+K)',
    status: 'To Do',
    priority: 'low',
    storyPoints: 3,
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

  // ─── Clear existing seed data ─────────────────────────────────
  const existingUser = await User.findOne({ email: SEED_USER.email });
  if (existingUser) {
    console.log(
      '⚠️  Seed user already exists — wiping existing seed data first...',
    );
    const existingWorkspace = await Workspace.findOne({
      slug: SEED_WORKSPACE.slug,
    });
    if (existingWorkspace) {
      const existingProject = await Project.findOne({
        workspaceId: existingWorkspace._id,
      });
      if (existingProject) {
        await Task.deleteMany({ projectId: existingProject._id });
        await Project.deleteOne({ _id: existingProject._id });
      }
      await Workspace.deleteOne({ _id: existingWorkspace._id });
    }
    await User.deleteOne({ _id: existingUser._id });
    console.log('   Cleared. Re-seeding...');
    console.log('');
  }

  // ─── Create user ─────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(SEED_USER.password, 12);
  const user = await User.create({
    name: SEED_USER.name,
    email: SEED_USER.email,
    password: hashedPassword,
  });
  console.log(`✅ User created: ${user.email}`);

  // ─── Create workspace ────────────────────────────────────────
  const workspace = await Workspace.create({
    name: SEED_WORKSPACE.name,
    slug: SEED_WORKSPACE.slug,
    description: SEED_WORKSPACE.description,
    ownerId: user._id,
    members: [
      {
        userId: user._id,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
  });
  console.log(`✅ Workspace created: ${workspace.name} (${workspace.slug})`);

  // ─── Create project ──────────────────────────────────────────
  const project = await Project.create({
    workspaceId: workspace._id,
    name: SEED_PROJECT.name,
    key: SEED_PROJECT.key,
    description: SEED_PROJECT.description,
    ownerId: user._id,
    statuses: SEED_PROJECT.statuses,
    taskCounter: SEED_TASKS.length,
    members: [
      {
        userId: user._id,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
  });
  console.log(`✅ Project created: ${project.name} (${project.key})`);

  // ─── Create tasks ────────────────────────────────────────────
  const taskDocs = SEED_TASKS.map((t, i) => ({
    projectId: project._id,
    workspaceId: workspace._id,
    taskNumber: i + 1,
    title: t.title,
    status: t.status,
    priority: t.priority,
    storyPoints: t.storyPoints,
    reporterId: user._id,
    assigneeId: user._id,
    watchers: [user._id],
    order: i,
  }));

  await Task.insertMany(taskDocs);
  console.log(`✅ ${SEED_TASKS.length} tasks created`);

  // ─── Summary ─────────────────────────────────────────────────
  console.log('');
  console.log('─────────────────────────────────────');
  console.log('🎉 Seed complete! Use these credentials:');
  console.log('');
  console.log(`   Email:    ${SEED_USER.email}`);
  console.log(`   Password: ${SEED_USER.password}`);
  console.log('');
  console.log(`   Workspace: ${SEED_WORKSPACE.name}`);
  console.log(`   Slug:      ${SEED_WORKSPACE.slug}`);
  console.log(`   Project:   ${SEED_PROJECT.name} (${SEED_PROJECT.key})`);
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
