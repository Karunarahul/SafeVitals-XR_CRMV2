import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

@Schema({
  collection: 'roles',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Role {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: false, index: true })
  isSystem: boolean;

  @Prop({ type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true })
  status: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
