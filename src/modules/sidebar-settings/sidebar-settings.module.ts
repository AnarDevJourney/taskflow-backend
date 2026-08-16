import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SidebarSettingsController } from './sidebar-settings.controller';
import { SidebarSettingsService } from './sidebar-settings.service';
import {
  SidebarSettings,
  SidebarSettingsSchema,
} from './schemas/sidebar-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SidebarSettings.name, schema: SidebarSettingsSchema },
    ]),
  ],
  controllers: [SidebarSettingsController],
  providers: [SidebarSettingsService],
})
export class SidebarSettingsModule {}
