import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SidebarSettings,
  SidebarSettingsDocument,
} from './schemas/sidebar-settings.schema';
import { UpsertSidebarSettingsDto } from './dto/upsert-sidebar-settings.dto';
import { toObjectId } from '@common/utils/object-id';

export interface SidebarModuleSettingResponse {
  id: string;
  visible: boolean;
}

export interface SidebarSettingsResponse {
  modules: SidebarModuleSettingResponse[];
  collapsed: boolean;
}

@Injectable()
export class SidebarSettingsService {
  constructor(
    @InjectModel(SidebarSettings.name)
    private sidebarSettingsModel: Model<SidebarSettingsDocument>,
  ) {}

  async findOne(userId: string): Promise<SidebarSettingsResponse | null> {
    const doc = await this.sidebarSettingsModel.findOne({
      userId: toObjectId(userId),
    });

    return doc ? this.toResponse(doc) : null;
  }

  async upsert(
    userId: string,
    dto: UpsertSidebarSettingsDto,
  ): Promise<SidebarSettingsResponse> {
    const update: Partial<SidebarSettings> = {};
    if (dto.collapsed !== undefined) update.collapsed = dto.collapsed;
    // stored as { moduleId, visible } — see the NOTE on SidebarModuleSetting
    // for why it can't be named `id`
    if (dto.modules !== undefined) {
      update.modules = dto.modules.map((m) => ({
        moduleId: m.id,
        visible: m.visible,
      }));
    }

    const doc = await this.sidebarSettingsModel.findOneAndUpdate(
      { userId: toObjectId(userId) },
      { $set: update, $setOnInsert: { userId: toObjectId(userId) } },
      { upsert: true, new: true },
    );

    return this.toResponse(doc!);
  }

  // maps the stored `moduleId` field back to the `id` the API/frontend uses
  private toResponse(doc: SidebarSettingsDocument): SidebarSettingsResponse {
    return {
      modules: doc.modules.map((m) => ({
        id: m.moduleId,
        visible: m.visible,
      })),
      collapsed: doc.collapsed,
    };
  }
}
