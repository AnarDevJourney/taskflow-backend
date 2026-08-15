import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TableSettingsController } from './table-settings.controller';
import { TableSettingsService } from './table-settings.service';
import {
  TableSettings,
  TableSettingsSchema,
} from './schemas/table-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TableSettings.name, schema: TableSettingsSchema },
    ]),
  ],
  controllers: [TableSettingsController],
  providers: [TableSettingsService],
})
export class TableSettingsModule {}
