import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ _id: false })
export class ReportAttachment {
  @Prop({ required: false, default: '' })
  id?: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: false, default: '' })
  name?: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  url: string;

  @Prop({ default: 0 })
  size: number;

  @Prop({ default: '' })
  mimeType: string;
}

@Schema({ _id: false })
export class ReportComment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true })
  authorName: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({
  collection: 'reports',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.workedOn = ret.content || ret.workedOn;
      ret.completed = ret.achievements || ret.completed;
      ret.blockers = ret.challenges || ret.blockers;
      ret.nextWeekPlan = ret.plans || ret.nextWeekPlan;
      ret.employeeId = ret.authorId || ret.employeeId;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  authorId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  employeeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: false, index: true })
  departmentId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  weekEnding: string; // YYYY-MM-DD

  @Prop({ trim: true, default: '' })
  weekStartDate?: string;

  @Prop({ trim: true, default: '' })
  weekEndDate?: string;

  @Prop({ default: '', trim: true })
  content: string;

  @Prop({ default: '', trim: true })
  workedOn?: string;

  @Prop({ default: '', trim: true })
  achievements: string;

  @Prop({ default: '', trim: true })
  completed?: string;

  @Prop({ default: '', trim: true })
  challenges: string;

  @Prop({ default: '', trim: true })
  blockers?: string;

  @Prop({ default: '', trim: true })
  plans: string;

  @Prop({ default: '', trim: true })
  nextWeekPlan?: string;

  @Prop({ type: [ReportAttachment], default: [] })
  attachments: ReportAttachment[];

  @Prop({
    default: 'submitted',
    enum: [
      'draft',
      'submitted',
      'reviewed',
      'Draft',
      'Submitted',
      'Under Review',
      'Needs Revision',
      'Approved',
    ],
    index: true,
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  reviewerId?: Types.ObjectId;

  @Prop({ default: '', trim: true })
  reviewMessage?: string;

  @Prop({ type: [ReportComment], default: [] })
  comments: ReportComment[];
}

export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ authorId: 1, weekEnding: 1 });
ReportSchema.index({ employeeId: 1, weekEnding: 1 });
ReportSchema.index({ departmentId: 1, weekEnding: 1 });
ReportSchema.index({ status: 1 });
