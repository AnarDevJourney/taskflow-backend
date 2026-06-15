import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  // GET /search?q=fix+bug&workspaceId=...
  // global search — tasks + projects + members
  @Get()
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
  searchInProject(
    @Param('projectId') projectId: string,
    @Query('q') query: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.searchService.searchInProject(query, projectId, workspaceId);
  }
}
