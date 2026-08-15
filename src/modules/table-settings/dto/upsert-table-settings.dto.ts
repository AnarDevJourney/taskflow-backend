import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TableColumnSettingDto {
  @ApiPropertyOptional({ description: 'Column identifier', example: 'dueDate' })
  @IsString()
  id: string;

  @ApiPropertyOptional({ description: 'Whether the column is shown', example: true })
  @IsBoolean()
  visible: boolean;

  @ApiPropertyOptional({ description: 'Saved column width in pixels — omitted means "use the default width"', example: 180, minimum: 40 })
  @IsOptional()
  @IsNumber()
  @Min(40)
  width?: number;
}

export class UpsertTableSettingsDto {
  @ApiPropertyOptional({ description: 'Selected table view/layout id', example: 'classic' })
  @IsOptional()
  @IsString()
  tableView?: string;

  @ApiPropertyOptional({ description: 'Rows per page', example: 25, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Columns in display order, each with a visibility flag',
    type: [TableColumnSettingDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TableColumnSettingDto)
  columns?: TableColumnSettingDto[];
}
