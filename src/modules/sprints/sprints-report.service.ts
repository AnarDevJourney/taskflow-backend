import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sprint, SprintDocument, SprintStatus } from './schemas/sprint.schema';
import { Task } from '@modules/tasks/schemas/task.schema';
import { toObjectId } from '@common/utils/object-id';

@Injectable()
export class SprintsReportService {
  constructor(
    @InjectModel(Sprint.name) private sprintModel: Model<SprintDocument>,
    @InjectModel(Task.name) private taskModel: Model<any>,
  ) {}

  // ─── Velocity (last N sprints) ───────────────────────────────────
  async getVelocity(projectId: string, limit = 10) {
    const sprints = await this.sprintModel
      .find({
        projectId: toObjectId(projectId),
        status: SprintStatus.COMPLETED,
      })
      .sort({ completedAt: -1 })
      .limit(limit)
      .select('name startDate endDate totalPoints completedPoints completedAt');

    return sprints.map((s) => ({
      sprintId: s._id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      completedAt: s.completedAt,
      totalPoints: s.totalPoints ?? 0,
      completedPoints: s.completedPoints ?? 0,
      velocity: s.completedPoints ?? 0,
    }));
  }

  // ─── Burndown Chart ──────────────────────────────────────────────
  // returns ideal line vs actual remaining points per day
  async getBurndown(sprintId: string) {
    const sprint = await this.sprintModel.findById(toObjectId(sprintId));
    if (!sprint) throw new NotFoundException('Sprint not found');

    const tasks = await this.taskModel
      .find({ sprintId: sprint._id, archivedAt: null })
      .select('status storyPoints updatedAt');

    const totalPoints = tasks.reduce(
      (sum: number, t: any) => sum + (t.storyPoints ?? 0),
      0,
    );

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const today = new Date();
    const chartEnd = today < end ? today : end;

    // build day-by-day array
    const days: {
      date: string;
      ideal: number;
      actual: number | null;
    }[] = [];

    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    let currentDay = new Date(start);
    let dayIndex = 0;

    while (currentDay <= chartEnd) {
      const dateStr = currentDay.toISOString().split('T')[0];

      // ideal burndown — linear from totalPoints to 0
      const ideal = Math.round(
        totalPoints - (totalPoints / totalDays) * dayIndex,
      );

      // actual — count remaining points at end of this day
      // for past days we approximate using current task state
      const actual =
        currentDay <= today
          ? tasks.reduce((sum: number, t: any) => {
              const isDone = t.status === tasks[tasks.length - 1]?.status; // last status = done
              return isDone ? sum : sum + (t.storyPoints ?? 0);
            }, 0)
          : null;

      days.push({ date: dateStr, ideal, actual });

      currentDay = new Date(currentDay.getTime() + 1000 * 60 * 60 * 24);
      dayIndex++;
    }

    return {
      sprint: {
        id: sprint._id,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
      },
      totalPoints,
      days,
    };
  }
}
