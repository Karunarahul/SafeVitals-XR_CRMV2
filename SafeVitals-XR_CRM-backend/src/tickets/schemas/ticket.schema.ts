import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TicketDocument = Ticket & Document;

@Schema({ _id: false })
export class TicketMessage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  senderName: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({
  collection: 'tickets',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.title = ret.subject || ret.title;
      ret.subject = ret.title || ret.subject;
      ret.createdBy = ret.creatorId || ret.createdBy;
      ret.assignedTo = ret.assigneeId || ret.assignedTo;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Ticket {
  @Prop({ required: true, unique: true, index: true })
  ticketNumber: string; // e.g. "TICK-0001"

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ trim: true })
  title?: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({
    default: 'software',
    enum: [
      'hardware',
      'software',
      'access',
      'hr',
      'other',
      'IT Support',
      'HR',
      'Facilities',
      'XR Hardware',
      'Other',
    ],
    index: true,
  })
  category: string;

  @Prop({
    default: 'medium',
    enum: ['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'],
  })
  priority: string;

  @Prop({
    default: 'open',
    enum: [
      'open',
      'in_progress',
      'resolved',
      'closed',
      'Open',
      'In Progress',
      'Waiting',
      'Resolved',
      'Closed',
    ],
    index: true,
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  creatorId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  assigneeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  assignedTo?: Types.ObjectId;

  @Prop({ type: [TicketMessage], default: [] })
  messages: TicketMessage[];
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
TicketSchema.index({ creatorId: 1, status: 1 });
TicketSchema.index({ assigneeId: 1, status: 1 });
TicketSchema.index({ category: 1, status: 1 });
