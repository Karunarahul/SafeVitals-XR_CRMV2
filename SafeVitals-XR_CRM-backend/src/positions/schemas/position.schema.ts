import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PositionDocument = Position & Document;

@Schema({
  collection: 'positions',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.name = ret.title || ret.name;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Position {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true, index: true })
  departmentId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Head', 'Custom'],
    default: 'Mid-Level',
  })
  level: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ default: false, index: true })
  isArchived: boolean;
}

export const PositionSchema = SchemaFactory.createForClass(Position);
PositionSchema.index({ departmentId: 1, title: 1 }, { unique: true });
PositionSchema.index({ isArchived: 1 });
