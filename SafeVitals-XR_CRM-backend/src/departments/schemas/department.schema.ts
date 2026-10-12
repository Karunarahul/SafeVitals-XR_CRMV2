import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({
  collection: 'departments',
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
export class Department {
  @Prop({ required: true, unique: true, trim: true, index: true })
  name: string;

  @Prop({ default: '', trim: true })
  code: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  managerId?: Types.ObjectId;

  @Prop({ default: '#3B82F6' })
  color: string;

  @Prop({ default: false, index: true })
  isArchived: boolean;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
