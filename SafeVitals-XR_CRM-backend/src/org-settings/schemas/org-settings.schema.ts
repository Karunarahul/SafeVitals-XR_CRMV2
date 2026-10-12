import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrgSettingsDocument = OrgSettings & Document;

@Schema({ _id: false })
export class WorkHours {
  @Prop({ default: '09:00' })
  start: string;

  @Prop({ default: '17:00' })
  end: string;
}

@Schema({ _id: false })
export class LeavePolicy {
  @Prop({ default: 20 })
  annualDays: number;

  @Prop({ default: 10 })
  sickDays: number;

  @Prop({ default: true })
  carryOver: boolean;
}

@Schema({ _id: false })
export class AttendancePolicy {
  @Prop({ default: 15 })
  gracePeriodMinutes: number;

  @Prop({ default: 12 })
  autoCheckoutHours: number;
}

@Schema({
  collection: 'org_settings',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    },
  },
})
export class OrgSettings {
  @Prop({ required: true, default: 'SafeVitals XR' })
  companyName: string;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({ default: 'YYYY-MM-DD' })
  dateFormat: string;

  @Prop({
    type: [String],
    default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  })
  workingDays: string[];

  @Prop({ type: WorkHours, default: () => ({}) })
  workHours: WorkHours;

  @Prop({ type: LeavePolicy, default: () => ({}) })
  leavePolicy: LeavePolicy;

  @Prop({ type: AttendancePolicy, default: () => ({}) })
  attendancePolicy: AttendancePolicy;
}

export const OrgSettingsSchema = SchemaFactory.createForClass(OrgSettings);
