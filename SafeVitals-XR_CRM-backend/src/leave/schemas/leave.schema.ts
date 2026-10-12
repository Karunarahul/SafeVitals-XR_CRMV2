import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeaveDocument = Leave & Document;

@Schema({
  collection: 'leave_requests',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.type = ret.leaveType || ret.type;
      ret.reviewedBy = ret.reviewerId || ret.reviewedBy;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Leave {
  @Prop({ required: true, trim: true, index: true })
  employeeId: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  employeeDocId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({
    required: true,
    default: 'annual',
    index: true,
  })
  type: string;

  @Prop({ trim: true })
  leaveType?: string;

  @Prop({ required: true, index: true })
  startDate: string; // YYYY-MM-DD

  @Prop({ required: true })
  endDate: string; // YYYY-MM-DD

  @Prop({ required: true, min: 0.5, default: 1 })
  days: number;

  @Prop({ default: '', trim: true })
  reason: string;

  @Prop({
    default: 'pending',
    enum: [
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'Pending',
      'Approved',
      'Rejected',
      'Cancelled',
    ],
    index: true,
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  reviewerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  reviewedBy?: Types.ObjectId;

  @Prop({ required: false })
  reviewedAt?: Date;

  @Prop({ default: '', trim: true })
  rejectionReason?: string;

  @Prop({ default: '', trim: true })
  reviewNote?: string;

  @Prop({ type: Date, default: Date.now })
  appliedAt: Date;
}

export const LeaveSchema = SchemaFactory.createForClass(Leave);
LeaveSchema.index({ employeeId: 1, startDate: 1 });
LeaveSchema.index({ employeeDocId: 1, startDate: 1 });
LeaveSchema.index({ startDate: 1, endDate: 1 });
