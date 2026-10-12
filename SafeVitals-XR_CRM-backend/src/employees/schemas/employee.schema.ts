import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmployeeDocument = Employee & Document;

@Schema({ _id: false })
export class Address {
  @Prop({ default: '' })
  street: string;

  @Prop({ default: '' })
  city: string;

  @Prop({ default: '' })
  state: string;

  @Prop({ default: '' })
  postalCode: string;

  @Prop({ default: '' })
  country: string;
}

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  relationship: string;

  @Prop({ default: '' })
  phone: string;
}

@Schema({ _id: false })
export class Salary {
  @Prop({ default: 0 })
  base: number;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 'Monthly' })
  payFrequency: string;
}

@Schema({ _id: false })
export class BankDetails {
  @Prop({ default: '' })
  accountName: string;

  @Prop({ default: '' })
  accountNumber: string;

  @Prop({ default: '' })
  bankName: string;

  @Prop({ default: '' })
  routingNumber: string;
}

@Schema({
  collection: 'employees',
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
export class Employee {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  employeeId: string; // e.g. "EMP-000001"

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  firstName?: string;

  @Prop({ trim: true, default: '' })
  lastName?: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ lowercase: true, trim: true, default: '' })
  secondaryEmail?: string;

  @Prop({ default: '', trim: true })
  phone: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: '' })
  avatarUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, unique: true, sparse: true })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: false, index: true })
  departmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team', required: false, index: true })
  teamId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Position', required: false, index: true })
  positionId?: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  position?: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: false, index: true })
  roleId?: Types.ObjectId;

  @Prop({ default: 'Employee', index: true })
  role: string;

  @Prop({ type: Types.ObjectId, ref: 'Employee', default: null })
  managerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Schedule', default: null })
  workScheduleId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['Active', 'Pending', 'Suspended', 'Deactivated'],
    default: 'Active',
    index: true,
  })
  status: string;

  @Prop({ default: () => new Date().toISOString().split('T')[0] })
  joiningDate: string;

  @Prop({ default: '' })
  dateOfBirth?: string;

  @Prop({ default: '' })
  nationalId?: string;

  @Prop({ type: Address, default: () => ({}) })
  address?: Address;

  @Prop({ type: EmergencyContact, default: () => ({}) })
  emergencyContact?: EmergencyContact;

  @Prop({ type: Salary, default: () => ({}) })
  salary?: Salary;

  @Prop({ type: BankDetails, default: () => ({}) })
  bankDetails?: BankDetails;

  @Prop({ default: '' })
  notes?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: [String], default: [] })
  skills?: string[];
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
EmployeeSchema.index({ departmentId: 1, teamId: 1, status: 1 });
EmployeeSchema.index({ name: 'text', email: 'text', employeeId: 'text' });
