import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { SidebarSettingsService } from './sidebar-settings.service';
import { UpsertSidebarSettingsDto } from './dto/upsert-sidebar-settings.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Sidebar Settings')
@ApiCookieAuth('cookie-access-token')
@Controller('sidebar-settings')
export class SidebarSettingsController {
  constructor(private sidebarSettingsService: SidebarSettingsService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's saved sidebar settings (module visibility/order, collapsed state)" })
  @ApiResponse({ status: 200, description: 'Saved settings, or null if the user has none yet' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  findOne(@CurrentUser() user: UserDocument) {
    return this.sidebarSettingsService.findOne(String(user._id));
  }

  @Put()
  @ApiOperation({ summary: "Save (create or update) the current user's sidebar settings" })
  @ApiResponse({ status: 200, description: 'Settings saved' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  upsert(
    @Body() dto: UpsertSidebarSettingsDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sidebarSettingsService.upsert(String(user._id), dto);
  }
}
