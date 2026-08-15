import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { TableSettingsService } from './table-settings.service';
import { UpsertTableSettingsDto } from './dto/upsert-table-settings.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Table Settings')
@ApiCookieAuth('cookie-access-token')
@Controller('table-settings')
export class TableSettingsController {
  constructor(private tableSettingsService: TableSettingsService) {}

  @Get(':key')
  @ApiOperation({ summary: "Get the current user's saved settings for a table (view style, page size, column visibility/order)" })
  @ApiParam({ name: 'key', description: 'Table identifier, e.g. "myTasks"' })
  @ApiResponse({ status: 200, description: 'Saved settings, or null if the user has none yet' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  findOne(
    @Param('key') key: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tableSettingsService.findOne(String(user._id), key);
  }

  @Put(':key')
  @ApiOperation({ summary: "Save (create or update) the current user's settings for a table" })
  @ApiParam({ name: 'key', description: 'Table identifier, e.g. "myTasks"' })
  @ApiResponse({ status: 200, description: 'Settings saved' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  upsert(
    @Param('key') key: string,
    @Body() dto: UpsertTableSettingsDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tableSettingsService.upsert(String(user._id), key, dto);
  }
}
