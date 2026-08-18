import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '@modules/tasks/schemas/task.schema';
import {
  Project,
  ProjectDocument,
} from '@modules/projects/schemas/project.schema';
import { NotificationType } from './schemas/notification.schema';
import { taskLink } from './notification-links';
import {
  DUE_SOON_WINDOW_HOURS,
  JOB_CREATE_NOTIFICATION,
  JOB_SCAN_DUE_TASKS,
  NOTIFICATIONS_QUEUE,
} from './notifications.constants';
import { CreateNotificationJob } from './types/notification-job.interface';

const SCHEDULER_ID = 'due-tasks-scan';
const SCAN_EVERY = '*/15 * * * *'; // every 15 minutes
const MAX_TASKS_PER_RUN = 500;

// tasks overdue for longer than this stop producing notifications — the
// assignee has already been told, repeating it forever is just noise
const OVERDUE_LOOKBACK_DAYS = 30;

/**
 * Owns the recurring due-date scan.
 *
 * Registers a BullMQ job scheduler on boot (idempotent — restarting the API
 * does not duplicate it) and holds the scan logic itself, which
 * NotificationsProcessor invokes when the scheduled job fires.
 */
@Injectable()
export class NotificationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private queue: Queue<CreateNotificationJob>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  async onModuleInit() {
    try {
      await this.queue.upsertJobScheduler(
        SCHEDULER_ID,
        { pattern: SCAN_EVERY },
        { name: JOB_SCAN_DUE_TASKS },
      );
      this.logger.log(`Due-task scan scheduled (${SCAN_EVERY})`);
    } catch (err) {
      this.logger.error('Failed to register due-task scan', err as Error);
    }
  }

  // ─── The scan ────────────────────────────────────────────────────
  async scanDueTasks(): Promise<{ dueSoon: number; overdue: number }> {
    const now = new Date();
    const soonCutoff = new Date(
      now.getTime() + DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const overdueFloor = new Date(
      now.getTime() - OVERDUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );

    const tasks = await this.taskModel
      .find({
        archivedAt: null,
        assigneeId: { $ne: null },
        dueDate: { $gt: overdueFloor, $lt: soonCutoff },
      })
      .select('title taskNumber status dueDate assigneeId projectId workspaceId')
      .limit(MAX_TASKS_PER_RUN)
      .lean();

    if (tasks.length === 0) return { dueSoon: 0, overdue: 0 };

    // one query for every project involved — a task in the project's final
    // status counts as done and is never chased about its due date
    const projectIds = [
      ...new Set(tasks.map((t) => t.projectId.toString())),
    ].map((id) => new Types.ObjectId(id));

    const projects = await this.projectModel
      .find({ _id: { $in: projectIds } })
      .select('key name statuses')
      .lean();

    const projectById = new Map(
      projects.map((p) => [(p._id as Types.ObjectId).toString(), p]),
    );

    let dueSoon = 0;
    let overdue = 0;

    for (const task of tasks) {
      const project = projectById.get(task.projectId.toString());
      if (!project) continue;

      const doneStatus = project.statuses[project.statuses.length - 1]?.name;
      if (task.status === doneStatus) continue;

      const dueDate = task.dueDate as Date;
      const isOverdue = dueDate.getTime() < now.getTime();
      const type = isOverdue
        ? NotificationType.TASK_OVERDUE
        : NotificationType.TASK_DUE_SOON;

      const taskKey = `${project.key}-${task.taskNumber}`;
      const taskId = (task._id as Types.ObjectId).toString();
      const taskUrl = taskLink(
        task.workspaceId.toString(),
        task.projectId.toString(),
        taskId,
      );

      const job: CreateNotificationJob = {
        recipientIds: [task.assigneeId!.toString()],
        actorId: null, // system notification, no human actor
        type,
        titleKey: isOverdue ? 'taskOverdue' : 'taskDueSoon',
        titleParams: isOverdue
          ? { taskKey }
          : { taskKey, hours: DUE_SOON_WINDOW_HOURS },
        bodyKey: 'taskDueOrOverdueBody',
        bodyParams: { taskTitle: task.title },
        link: taskUrl,
        taskId,
        projectId: task.projectId.toString(),
        workspaceId: task.workspaceId.toString(),
        // includes the due date, so rescheduling a task makes it eligible
        // for a fresh reminder while the scan itself stays idempotent
        dedupeKey: `${type}:${taskId}:${dueDate.getTime()}`,
      };

      await this.queue.add(JOB_CREATE_NOTIFICATION, job);

      if (isOverdue) overdue++;
      else dueSoon++;
    }

    this.logger.log(
      `Due-task scan: ${dueSoon} due-soon, ${overdue} overdue notification(s) queued`,
    );

    return { dueSoon, overdue };
  }
}
