import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { TasksService } from '@modules/tasks/tasks.service';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { toObjectId } from '@common/utils/object-id';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '@common/utils/pagination';
import { ActivityService } from '@modules/activity/activity.service';
import { ActivityAction } from '@modules/activity/enums/activity-action.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { ProjectsService } from '@modules/projects/projects.service';
import { AppConfigService } from '@config/config.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private tasksService: TasksService,
    private activityService: ActivityService,
    private notificationsService: NotificationsService,
    private projectsService: ProjectsService,
    private config: AppConfigService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────
  async create(
    workspaceId: string,
    projectId: string,
    taskId: string,
    dto: CreateCommentDto,
    user: UserDocument,
  ): Promise<CommentDocument> {
    // validates workspace + project membership
    const task = await this.tasksService.findOne(
      workspaceId,
      projectId,
      taskId,
      user,
    );
    const project = await this.projectsService.findOne(
      workspaceId,
      projectId,
      user,
    );

    const mentions = this.parseMentions(dto.body);
    const userId = user._id as Types.ObjectId;

    const comment = await this.commentModel.create({
      taskId: task._id,
      projectId: toObjectId(projectId),
      workspaceId: toObjectId(workspaceId),
      authorId: userId,
      body: dto.body,
      mentions,
    });

    await this.activityService.log({
      taskId: task._id,
      projectId: comment.projectId,
      workspaceId: comment.workspaceId,
      actorId: user._id,
      action: ActivityAction.COMMENT_ADDED,
      meta: dto.body.substring(0, 100),
    });

    const actorId = userId.toString();
    const snippet = dto.body.substring(0, 100);
    const taskKey = `${project.key}-${task.taskNumber}`;
    const taskUrl = `${this.config.appUrl}/w/${workspaceId}/p/${projectId}/tasks/${taskId}`;
    const notifyBase = {
      actorId,
      actorName: user.name,
      taskId: (task._id as Types.ObjectId).toString(),
      taskKey,
      taskTitle: task.title,
      projectId: task.projectId.toString(),
      workspaceId: task.workspaceId.toString(),
      commentSnippet: snippet,
      taskUrl,
    };

    // notify mentioned users (excluding self)
    const mentionIds = mentions
      .map((m) => m.toString())
      .filter((id) => id !== actorId);

    if (mentionIds.length > 0) {
      await this.notificationsService.notifyCommentMention({
        ...notifyBase,
        recipientIds: mentionIds,
      });
    }

    // notify watchers (excluding author and already-mentioned users)
    const mentionSet = new Set(mentionIds);
    const watcherIds = task.watchers
      .map((w) => (w._id ?? w).toString())
      .filter((id) => id !== actorId && !mentionSet.has(id));

    if (watcherIds.length > 0) {
      await this.notificationsService.notifyCommentAdded({
        ...notifyBase,
        recipientIds: watcherIds,
      });
    }

    return comment.populate('authorId', 'name email avatarUrl');
  }

  // ─── Find All for a Task ─────────────────────────────────────────
  async findAll(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: UserDocument,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<CommentDocument>> {
    // validates membership
    const task = await this.tasksService.findOne(
      workspaceId,
      projectId,
      taskId,
      user,
    );

    const { skip, limit: take } = getPaginationParams({ page, limit });

    const filter = { taskId: task._id, deletedAt: null };

    const [items, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: 1 }) // oldest first — natural conversation order
        .skip(skip)
        .limit(take)
        .populate('authorId', 'name email avatarUrl')
        .populate('mentions', 'name email'),
      this.commentModel.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, take) };
  }

  // ─── Update ─────────────────────────────────────────────────────
  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateCommentDto,
    user: UserDocument,
  ): Promise<CommentDocument> {
    const comment = await this.findOneAndAssertAuthor(commentId, taskId, user);

    const mentions = this.parseMentions(dto.body);

    comment.body = dto.body;
    comment.mentions = mentions;
    comment.editedAt = new Date();

    await comment.save();

    await this.activityService.log({
      taskId: comment.taskId,
      projectId: comment.projectId,
      workspaceId: comment.workspaceId,
      actorId: user._id,
      action: ActivityAction.COMMENT_EDITED,
      meta: dto.body.substring(0, 100),
    });

    return comment.populate('authorId', 'name email avatarUrl');
  }

  // ─── Delete (soft) ───────────────────────────────────────────────
  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    user: UserDocument,
  ): Promise<void> {
    const comment = await this.findOneAndAssertAuthor(commentId, taskId, user);

    comment.deletedAt = new Date();
    comment.body = '[deleted]'; // wipe content but keep thread structure
    comment.mentions = [];
    await comment.save();

    await this.activityService.log({
      taskId: comment.taskId,
      projectId: comment.projectId,
      workspaceId: comment.workspaceId,
      actorId: user._id,
      action: ActivityAction.COMMENT_DELETED,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  // extract @[userId] mentions from comment body
  // frontend encodes mentions as @[507f1f77bcf86cd799439011]
  private parseMentions(body: string): Types.ObjectId[] {
    const mentionRegex = /@\[([a-f\d]{24})\]/gi;
    const ids: Types.ObjectId[] = [];
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(body)) !== null) {
      try {
        ids.push(toObjectId(match[1]));
      } catch {
        // skip invalid IDs
      }
    }

    // deduplicate
    return [...new Map(ids.map((id) => [id.toString(), id])).values()];
  }

  private async findOneAndAssertAuthor(
    commentId: string,
    taskId: string,
    user: UserDocument,
  ): Promise<CommentDocument> {
    const comment = await this.commentModel.findOne({
      _id: toObjectId(commentId),
      taskId: toObjectId(taskId),
      deletedAt: null,
    });

    if (!comment) throw new NotFoundException('Comment not found');

    const userId = (user._id as Types.ObjectId).toString();

    if (comment.authorId.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return comment;
  }
}
