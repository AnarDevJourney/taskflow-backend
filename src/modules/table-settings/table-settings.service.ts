import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TableSettings,
  TableSettingsDocument,
} from './schemas/table-settings.schema';
import { UpsertTableSettingsDto } from './dto/upsert-table-settings.dto';
import { toObjectId } from '@common/utils/object-id';

export interface TableColumnSettingResponse {
  id: string;
  visible: boolean;
  width: number | null;
}

export interface TableSettingsResponse {
  tableView: string | null;
  pageSize: number | null;
  columns: TableColumnSettingResponse[];
}

@Injectable()
export class TableSettingsService {
  constructor(
    @InjectModel(TableSettings.name)
    private tableSettingsModel: Model<TableSettingsDocument>,
  ) {}

  async findOne(
    userId: string,
    key: string,
  ): Promise<TableSettingsResponse | null> {
    const doc = await this.tableSettingsModel.findOne({
      userId: toObjectId(userId),
      key,
    });

    return doc ? this.toResponse(doc) : null;
  }

  async upsert(
    userId: string,
    key: string,
    dto: UpsertTableSettingsDto,
  ): Promise<TableSettingsResponse> {
    const update: Partial<TableSettings> = {};
    if (dto.tableView !== undefined) update.tableView = dto.tableView;
    if (dto.pageSize !== undefined) update.pageSize = dto.pageSize;
    // the schema stores each column as { columnId, visible } — see the
    // NOTE on TableColumnSetting for why it can't be named `id`
    if (dto.columns !== undefined) {
      update.columns = dto.columns.map((c) => ({
        columnId: c.id,
        visible: c.visible,
        width: c.width ?? null,
      }));
    }

    const doc = await this.tableSettingsModel.findOneAndUpdate(
      { userId: toObjectId(userId), key },
      { $set: update, $setOnInsert: { userId: toObjectId(userId), key } },
      { upsert: true, new: true },
    );

    return this.toResponse(doc!);
  }

  // maps the stored `columnId` field back to the `id` the API/frontend uses
  private toResponse(doc: TableSettingsDocument): TableSettingsResponse {
    return {
      tableView: doc.tableView,
      pageSize: doc.pageSize,
      columns: doc.columns.map((c) => ({
        id: c.columnId,
        visible: c.visible,
        width: c.width ?? null,
      })),
    };
  }
}
