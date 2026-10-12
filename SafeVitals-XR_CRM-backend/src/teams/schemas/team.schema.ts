import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeamDocument = Team & Document;

@Schema({
  collection: 'teams',
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
export class Team {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true, index: true })
  departmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  leaderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  leadId?: Types.ObjectId;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ default: false, index: true })
  isArchived: boolean;
}

export const TeamSchema = SchemaFactory.createForClass(Team);
TeamSchema.index({ departmentId: 1, name: 1 }, { unique: true });
TeamSchema.index({ isArchived: 1 });
