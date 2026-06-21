import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

// nested under tasks — /workspaces/:wsId/projects/:pId/tasks/:tId/comments
@ApiTags('Comments')
@ApiCookieAuth('cookie-access-token')
@Controller(
  'workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments',
)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment to a task (supports @[userId] mention syntax)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 201, description: 'Comment created — notifications sent to mentioned users and watchers' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.commentsService.create(
      workspaceId,
      projectId,
      taskId,
      dto,
      user,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List comments for a task, oldest first, paginated' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page (default 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of comments with author details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.commentsService.findAll(
      workspaceId,
      projectId,
      taskId,
      user,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Edit a comment (author only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiParam({ name: 'commentId', description: 'MongoDB ObjectId of the comment' })
  @ApiResponse({ status: 200, description: 'Comment updated — editedAt timestamp set' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Can only edit your own comments' })
  @ApiResponse({ status: 404, description: 'Comment or task not found' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.commentsService.update(
      workspaceId,
      projectId,
      taskId,
      commentId,
      dto,
      user,
    );
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a comment (author only — body replaced with [deleted])' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiParam({ name: 'commentId', description: 'MongoDB ObjectId of the comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted (soft — thread structure preserved)' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Can only delete your own comments' })
  @ApiResponse({ status: 404, description: 'Comment or task not found' })
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.commentsService.remove(
      workspaceId,
      projectId,
      taskId,
      commentId,
      user,
    );
  }
}
