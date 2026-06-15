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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

// nested under tasks — /workspaces/:wsId/projects/:pId/tasks/:tId/comments
@Controller(
  'workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments',
)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
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
