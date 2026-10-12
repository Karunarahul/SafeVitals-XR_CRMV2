import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
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
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ default: 'System' })
  userName: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true, index: true })
  module: string;

  @Prop({ default: '', trim: true })
  targetId: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  details: Record<string, any> | string;

  @Prop({ default: '127.0.0.1' })
  ipAddress: string;

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ module: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

