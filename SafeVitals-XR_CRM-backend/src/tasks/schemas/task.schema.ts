import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskDocument = Task & Document;

@Schema({
  collection: 'tasks',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.assigneeId = ret.assignedTo || ret.assigneeId;
      ret.reporterId = ret.createdBy || ret.reporterId;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Task {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  assigneeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  reporterId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  createdBy?: Types.ObjectId;

  @Prop({
    default: 'todo',
    enum: [
      'todo',
      'in_progress',
      'review',
      'done',
      'To Do',
      'In Progress',
      'Blocked',
      'Done',
      'Cancelled',
    ],
    index: true,
  })
  status: string;

  @Prop({
    default: 'medium',
    enum: ['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'],
  })
  priority: string;

  @Prop({ required: false, index: true })
  dueDate?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ assigneeId: 1, status: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ status: 1, dueDate: 1 });
