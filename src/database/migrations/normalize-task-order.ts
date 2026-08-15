import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────
// Normalizes Task.order values per (projectId, status) column so
// they form a contiguous 0..n-1 sequence, ordered by the existing
// (possibly gapped/duplicated) order value, falling back to
// createdAt for ties. Fixes columns left inconsistent by the old
// buggy reorder() logic.
//
// Usage:
//   npm run migrate:normalize-order            → uses .env (local dev)
//   MIGRATE_ENV=docker npm run migrate:normalize-order  → uses .env.docker
//
// Safe to re-run — it's idempotent.
// ─────────────────────────────────────────────────────────────────
const envFile = process.env.MIGRATE_ENV === 'docker' ? '.env.docker' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const DATABASE_URI = process.env.DATABASE_URI as string;

if (!DATABASE_URI) {
  console.error('❌ DATABASE_URI not found in env file. Aborting.');
  process.exit(1);
}

// Minimal inline schema — self-contained, avoids ts-node path issues.
const taskSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: { type: String, required: true },
    order: { type: Number, required: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: false },
);

const Task = mongoose.model('Task', taskSchema, 'tasks');

async function run() {
  await mongoose.connect(DATABASE_URI);
  console.log('✅ Connected to', DATABASE_URI);

  // Group non-archived tasks by (projectId, status)
  const groups = await Task.aggregate<{
    _id: { projectId: mongoose.Types.ObjectId; status: string };
  }>([
    { $match: { archivedAt: null } },
    { $group: { _id: { projectId: '$projectId', status: '$status' } } },
  ]);

  console.log(`Found ${groups.length} (project, status) columns to check.`);

  let columnsFixed = 0;
  let tasksUpdated = 0;

  for (const group of groups) {
    const { projectId, status } = group._id;

    const tasks = await Task.find({
      projectId,
      status,
      archivedAt: null,
    })
      .sort({ order: 1, createdAt: 1 })
      .select('_id order');

    const bulkOps: mongoose.AnyBulkWriteOperation[] = [];
    let isAlreadyNormalized = true;

    tasks.forEach((task, index) => {
      if (task.order !== index) {
        isAlreadyNormalized = false;
        bulkOps.push({
          updateOne: {
            filter: { _id: task._id },
            update: { $set: { order: index } },
          },
        });
      }
    });

    if (!isAlreadyNormalized) {
      await Task.bulkWrite(bulkOps);
      columnsFixed += 1;
      tasksUpdated += bulkOps.length;
      console.log(
        `  ↳ normalized project=${projectId} status="${status}" (${bulkOps.length} task(s) updated)`,
      );
    }
  }

  console.log(
    `\n✅ Done. ${columnsFixed}/${groups.length} column(s) needed fixing, ${tasksUpdated} task(s) updated.`,
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
