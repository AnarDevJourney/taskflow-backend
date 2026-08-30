import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '@modules/tasks/schemas/task.schema';
import {
  Project,
  ProjectDocument,
} from '@modules/projects/schemas/project.schema';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { User } from '@modules/users/schemas/user.schema';
import {
  Workspace,
  WorkspaceDocument,
} from '@modules/workspaces/schemas/workspace.schema';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { ProjectsService } from '@modules/projects/projects.service';
import { toObjectId } from '@common/utils/object-id';

const MAX_RESULTS = 10;

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
    private workspacesService: WorkspacesService,
    private projectsService: ProjectsService,
  ) {}

  // ─── Global search ───────────────────────────────────────────────
  // searches tasks, projects, and members in one shot
  async globalSearch(query: string, workspaceId: string, user: UserDocument) {
    if (!query || query.trim().length < 2) {
      return { tasks: [], projects: [], members: [] };
    }

    // throws 404/403 if the workspace doesn't exist or the user isn't a
    // member — must run before any workspace-scoped data is read
    await this.workspacesService.findOne(workspaceId, user);

    const wsId = toObjectId(workspaceId);
    const q = query.trim();

    const [tasks, projects, members] = await Promise.all([
      this.searchTasks(q, wsId),
      this.searchProjects(q, wsId),
      this.searchMembers(q, wsId),
    ]);

    return { tasks, projects, members };
  }

  // ─── Task search ─────────────────────────────────────────────────
  private async searchTasks(query: string, workspaceId: Types.ObjectId) {
    // try full-text search first (uses text index on title + description)
    const textResults = await this.taskModel
      .find({
        workspaceId,
        archivedAt: null,
        $text: { $search: query },
      })
      .select('title status priority taskNumber projectId assigneeId')
      .populate('projectId', 'name key color')
      .populate('assigneeId', 'name avatarUrl')
      .limit(MAX_RESULTS)
      .lean();

    if (textResults.length > 0) return textResults;

    // fallback to regex for partial matches
    return this.taskModel
      .find({
        workspaceId,
        archivedAt: null,
        title: { $regex: query, $options: 'i' },
      })
      .select('title status priority taskNumber projectId assigneeId')
      .populate('projectId', 'name key color')
      .populate('assigneeId', 'name avatarUrl')
      .limit(MAX_RESULTS)
      .lean();
  }

  // ─── Project search ──────────────────────────────────────────────
  private async searchProjects(query: string, workspaceId: Types.ObjectId) {
    return this.projectModel
      .find({
        workspaceId,
        archivedAt: null,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { key: { $regex: query, $options: 'i' } },
        ],
      })
      .select('name key color icon')
      .limit(MAX_RESULTS)
      .lean();
  }

  // ─── Member search ───────────────────────────────────────────────
  private async searchMembers(query: string, workspaceId: Types.ObjectId) {
    const workspace = await this.workspaceModel
      .findById(workspaceId)
      .select('members.userId')
      .lean();

    const memberIds = workspace?.members?.map((m) => m.userId) ?? [];

    return this.userModel
      .find({
        _id: { $in: memberIds },
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
        isActive: true,
      })
      .select('name email avatarUrl')
      .limit(MAX_RESULTS)
      .lean();
  }

  // ─── Task search within a project ────────────────────────────────
  // used by the project board quick filter
  async searchInProject(
    query: string,
    projectId: string,
    workspaceId: string,
    user: UserDocument,
  ) {
    if (!query || query.trim().length < 2) return [];

    // throws 404/403 if the project/workspace doesn't exist or the user
    // isn't a project/workspace member
    await this.projectsService.findOne(workspaceId, projectId, user);

    const q = query.trim();

    // also match task number e.g. "TF-42" or just "42"
    const taskNumberMatch = q.match(/^[a-z]+-?(\d+)$/i) || q.match(/^(\d+)$/);
    const taskNumber = taskNumberMatch ? parseInt(taskNumberMatch[1]) : null;

    const filter: Record<string, any> = {
      projectId: toObjectId(projectId),
      workspaceId: toObjectId(workspaceId),
      archivedAt: null,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        ...(taskNumber ? [{ taskNumber }] : []),
      ],
    };

    return this.taskModel
      .find(filter)
      .select('title status priority taskNumber assigneeId')
      .populate('assigneeId', 'name avatarUrl')
      .limit(MAX_RESULTS)
      .lean();
  }
}
