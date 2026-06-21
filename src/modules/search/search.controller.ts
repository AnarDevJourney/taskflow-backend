import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Search')
@ApiCookieAuth('cookie-access-token')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  // GET /search?q=fix+bug&workspaceId=...
  // global search — tasks + projects + members
  @Get()
  @ApiOperation({ summary: 'Global search across tasks, projects and members in a workspace (min 2 chars)' })
  @ApiQuery({ name: 'q', description: 'Search query (minimum 2 characters)', example: 'login bug' })
  @ApiQuery({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace to search within', example: '507f1f77bcf86cd799439010' })
  @ApiResponse({ status: 200, description: 'Returns { tasks, projects, members } — up to 10 results per category' })
  @ApiResponse({ status: 400, description: 'Invalid workspaceId format' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  globalSearch(
    @Query('q') query: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.searchService.globalSearch(query, workspaceId, user);
  }

  // GET /search/projects/:projectId?q=fix+bug&workspaceId=...
  // scoped search within a single project board
  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Search tasks within a specific project board (supports task number e.g. BE-42)' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project to search within' })
  @ApiQuery({ name: 'q', description: 'Search query (minimum 2 characters, supports task number e.g. "42" or "BE-42")', example: 'fix login' })
  @ApiQuery({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace', example: '507f1f77bcf86cd799439010' })
  @ApiResponse({ status: 200, description: 'Array of matching tasks with assignee details — up to 10 results' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  searchInProject(
    @Param('projectId') projectId: string,
    @Query('q') query: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.searchService.searchInProject(query, projectId, workspaceId);
  }
}
