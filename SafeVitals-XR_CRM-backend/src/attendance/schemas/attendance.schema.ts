import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AttendanceDocument = Attendance & Document;

@Schema({ _id: false })
export class AttendanceBreak {
  @Prop({ required: true })
  start: Date;

  @Prop({ required: false, default: null })
  end?: Date;

  @Prop({ default: 0 })
  durationMinutes: number;
}

@Schema({ _id: false })
export class AttendanceLocation {
  @Prop({ default: 'Spatial Lab HQ' })
  address?: string;

  @Prop({ default: 0 })
  lat?: number;

  @Prop({ default: 0 })
  lng?: number;
}

@Schema({
  collection: 'attendance',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      ret.checkIn = ret.checkInAt || ret.checkIn;
      ret.checkOut = ret.checkOutAt || ret.checkOut;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class Attendance {
  @Prop({ required: true, trim: true, index: true })
  employeeId: string; // Sequential employee ID e.g. "EMP-000001"

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false, index: true })
  employeeDocId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: false, default: null })
  checkIn?: Date;

  @Prop({ required: false, default: null })
  checkInAt?: Date;

  @Prop({ required: false, default: null })
  checkOut?: Date;

  @Prop({ required: false, default: null })
  checkOutAt?: Date;

  @Prop({
    default: 'present',
    enum: [
      'present',
      'absent',
      'late',
      'half_day',
      'on_leave',
      'Working',
      'On Break',
      'Checked Out',
      'Absent',
      'Late',
      'On Leave',
    ],
    index: true,
  })
  status: string;

  @Prop({ default: 'office', enum: ['office', 'remote', 'hybrid'] })
  workMode: string;

  @Prop({ default: '', trim: true })
  notes: string;

  @Prop({ type: [AttendanceBreak], default: [] })
  breaks: AttendanceBreak[];

  @Prop({ default: 0 })
  totalWorkMinutes: number;

  @Prop({ default: 0 })
  totalWorkHours: number;

  @Prop({ default: 0 })
  overtimeMinutes: number;

  @Prop({ default: false })
  isLate: boolean;

  @Prop({ type: AttendanceLocation, default: () => ({}) })
  location?: AttendanceLocation;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ employeeDocId: 1, date: 1 });
AttendanceSchema.index({ date: 1, status: 1 });
