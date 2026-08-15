import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TableSettingsDocument = TableSettings & Document;

// one entry per visible column, in display order — array order IS the
// column order the table renders in
//
// NOTE: the field is `columnId`, not `id` — Mongoose subdocuments auto-add
// a virtual `id` getter/setter derived from `_id`. A real schema path also
// named `id` collides with it: the virtual setter intercepts assignment,
// so the real value silently never gets persisted (only an auto-generated
// `_id` survives). The API still speaks `id` — see TableSettingsService's
// toColumnDto/toColumnDoc mappers at the boundary.
@Schema({ id: false }) // belt-and-braces: also drop the virtual so this can't recur for other fields
export class TableColumnSetting {
  @Prop({ required: true })
  columnId: string;

  @Prop({ required: true, default: true })
  visible: boolean;

  // saved column width in pixels, set once the user drags a resize handle;
  // absent means "use the view's default width" for that column
  @Prop({ default: null, type: Number })
  width: number | null;
}

export const TableColumnSettingSchema =
  SchemaFactory.createForClass(TableColumnSetting);

// per-user, per-table saved preferences (view style, page size, column
// visibility + order) — `key` identifies which table this is for (e.g.
// "myTasks"), so the same collection can serve other tables later
@Schema({ timestamps: true })
export class TableSettings {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ default: null, type: String })
  tableView: string | null;

  @Prop({ default: null, type: Number })
  pageSize: number | null;

  @Prop({ type: [TableColumnSettingSchema], default: [] })
  columns: TableColumnSetting[];
}

export const TableSettingsSchema = SchemaFactory.createForClass(TableSettings);

// one settings document per user per table
TableSettingsSchema.index({ userId: 1, key: 1 }, { unique: true });
