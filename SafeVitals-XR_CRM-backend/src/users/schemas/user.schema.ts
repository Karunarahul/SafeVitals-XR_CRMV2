import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserStatus {
  PENDING = 'Pending',
  ACTIVE = 'Active',
  SUSPENDED = 'Suspended',
  DEACTIVATED = 'Deactivated',
}

@Schema({
  collection: 'users',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret: any) => {
      ret.id = ret._id.toString();
      delete ret.password;
      delete ret.passwordHash;
      delete ret.otp;
      delete ret.otpCodeHash;
      delete ret.otpExpiresAt;
      delete ret.otpAttempts;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordTokenHash;
      delete ret.resetPasswordExpiresAt;
      delete ret.activationToken;
      delete ret.activationTokenExpiresAt;
      delete ret.registrationToken;
      delete ret.registrationTokenExpiresAt;
      delete ret.twoFactorSecret;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ required: false, select: false })
  passwordHash?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  firstName?: string;

  @Prop({ trim: true, default: '' })
  lastName?: string;

  @Prop({ trim: true, default: '' })
  phone?: string;

  @Prop({ required: true, default: 'Employee' })
  role: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: false, index: true })
  roleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: false, index: true })
  departmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team', required: false, index: true })
  teamId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Position', required: false, index: true })
  positionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Employee', required: false })
  employeeDocId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING,
    index: true,
  })
  status: UserStatus;

  @Prop({ default: false })
  isSuperAdmin: boolean;

  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop({ default: false })
  isTwoFactorEnabled: boolean;

  @Prop({ required: false, select: false })
  twoFactorSecret?: string;

  // Ephemeral 2FA OTP State (Hashed)
  @Prop({ required: false, select: false })
  otp?: string;

  @Prop({ required: false, select: false })
  otpCodeHash?: string;

  @Prop({ required: false, select: false })
  otpExpiresAt?: Date;

  @Prop({ default: 0, select: false })
  otpAttempts: number;

  // Password Recovery (Hashed token)
  @Prop({ required: false, select: false })
  resetPasswordToken?: string;

  @Prop({ required: false, select: false })
  resetPasswordTokenHash?: string;

  @Prop({ required: false, select: false })
  resetPasswordExpiresAt?: Date;

  // Invitation / Account Activation (Hashed token)
  @Prop({ required: false, select: false })
  activationToken?: string;

  @Prop({ required: false, select: false })
  activationTokenExpiresAt?: Date;

  @Prop({ type: String, unique: true, sparse: true })
  firebaseUid?: string;

  @Prop({ default: '' })
  avatar?: string;

  @Prop({ default: '' })
  avatarUrl?: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  mustChangePassword: boolean;

  // Ephemeral Registration Verification Token (Hashed or random)
  @Prop({ required: false, select: false, index: true, sparse: true })
  registrationToken?: string;

  @Prop({ required: false, select: false })
  registrationTokenExpiresAt?: Date;

  @Prop({ required: false })
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ status: 1, role: 1 });
UserSchema.index({ employeeDocId: 1 }, { sparse: true });

UserSchema.virtual('fullName').get(function (this: UserDocument) {
  if (this.name) return this.name;
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});
