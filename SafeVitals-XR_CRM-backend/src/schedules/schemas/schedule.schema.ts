import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScheduleDocument = Schedule & Document;

@Schema({
  collection: 'work_schedules',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.shiftStart = ret.startTime || ret.shiftStart;
      ret.shiftEnd = ret.endTime || ret.shiftEnd;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Schedule {
  @Prop({ trim: true, default: 'Standard Shift' })
  name?: string;

  @Prop({ required: false, trim: true, index: true })
  employeeId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  employeeDocId?: Types.ObjectId;

  @Prop({ required: false, index: true })
  date?: string; // YYYY-MM-DD

  @Prop({ default: '09:00' })
  shiftStart: string;

  @Prop({ default: '09:00' })
  startTime?: string;

  @Prop({ default: '17:00' })
  shiftEnd: string;

  @Prop({ default: '17:00' })
  endTime?: string;

  @Prop({
    type: [String],
    default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  })
  workDays?: string[];

  @Prop({ default: 15 })
  gracePeriodMinutes?: number;

  @Prop({ default: 'UTC' })
  timezone?: string;

  @Prop({
    default: 'work',
    enum: ['work', 'off', 'holiday', 'on_call'],
  })
  type: string;

  @Prop({ default: '', trim: true })
  notes: string;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
ScheduleSchema.index({ employeeId: 1, date: 1 });
ScheduleSchema.index({ employeeDocId: 1, date: 1 });
ScheduleSchema.index({ date: 1 });
