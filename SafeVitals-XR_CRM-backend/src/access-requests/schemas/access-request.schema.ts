import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AccessRequestDocument = AccessRequest & Document;

@Schema({
  collection: 'access_requests',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.requestedSystem = ret.requestType || ret.requestedSystem;
      ret.requestType = ret.requestedSystem || ret.requestType;
      ret.reviewerId = ret.reviewedBy || ret.reviewerId;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class AccessRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  employeeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  employeeDocId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  requestType: string; // e.g. "role_change", "department_transfer", "system_access"

  @Prop({ trim: true, default: '' })
  requestedSystem?: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: false })
  targetRoleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: false })
  targetDepartmentId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({
    default: 'pending',
    enum: [
      'pending',
      'approved',
      'rejected',
      'Pending',
      'Approved',
      'Rejected',
      'Expired',
    ],
    index: true,
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  reviewerId?: Types.ObjectId;

  @Prop({ required: false })
  reviewedAt?: Date;

  @Prop({ default: '', trim: true })
  reviewNotes: string;

  @Prop({ default: '', trim: true })
  reviewNote?: string;
}

export const AccessRequestSchema = SchemaFactory.createForClass(AccessRequest);
AccessRequestSchema.index({ userId: 1, status: 1 });
AccessRequestSchema.index({ employeeId: 1, status: 1 });
AccessRequestSchema.index({ status: 1, createdAt: -1 });
