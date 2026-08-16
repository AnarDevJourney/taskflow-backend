import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SidebarSettingsDocument = SidebarSettings & Document;

// one entry per sidebar nav module, in display order — array order IS the
// order the sidebar renders modules in
//
// NOTE: the field is `moduleId`, not `id` — same Mongoose virtual-`id`
// collision as TableColumnSetting (see that schema's comment): a real path
// named `id` on a subdocument gets silently swallowed by the auto-added
// virtual getter/setter. Renaming avoids it; `{id: false}` drops the
// virtual too, belt-and-braces.
@Schema({ id: false })
export class SidebarModuleSetting {
  @Prop({ required: true })
  moduleId: string;

  @Prop({ required: true, default: true })
  visible: boolean;
}

export const SidebarModuleSettingSchema = SchemaFactory.createForClass(
  SidebarModuleSetting,
);

// per-user saved sidebar preferences — which nav modules are shown, in
// which order, and whether the sidebar is collapsed
@Schema({ timestamps: true })
export class SidebarSettings {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [SidebarModuleSettingSchema], default: [] })
  modules: SidebarModuleSetting[];

  @Prop({ default: false })
  collapsed: boolean;
}

export const SidebarSettingsSchema =
  SchemaFactory.createForClass(SidebarSettings);
