import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SidebarModuleSettingDto {
  @ApiPropertyOptional({ description: 'Nav module identifier', example: 'myTasks' })
  @IsString()
  id: string;

  @ApiPropertyOptional({ description: 'Whether the module is shown in the sidebar', example: true })
  @IsBoolean()
  visible: boolean;
}

export class UpsertSidebarSettingsDto {
  @ApiPropertyOptional({
    description: 'Nav modules in display order, each with a visibility flag',
    type: [SidebarModuleSettingDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SidebarModuleSettingDto)
  modules?: SidebarModuleSettingDto[];

  @ApiPropertyOptional({ description: 'Whether the sidebar is collapsed', example: false })
  @IsOptional()
  @IsBoolean()
  collapsed?: boolean;
}
