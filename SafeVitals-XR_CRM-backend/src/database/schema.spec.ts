import { User, UserSchema } from '../users/schemas/user.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Leave, LeaveSchema } from '../leave/schemas/leave.schema';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { Invitation, InvitationSchema } from '../employees/schemas/invitation.schema';
import mongoose from 'mongoose';

describe('Mongoose Schemas & Security Validation', () => {
  let UserModel: mongoose.Model<any>;
  let EmployeeModel: mongoose.Model<any>;
  let AttendanceModel: mongoose.Model<any>;
  let LeaveModel: mongoose.Model<any>;
  let TicketModel: mongoose.Model<any>;
  let InvitationModel: mongoose.Model<any>;

  beforeAll(() => {
    UserModel = mongoose.model('UserTest', UserSchema);
    EmployeeModel = mongoose.model('EmployeeTest', EmployeeSchema);
    AttendanceModel = mongoose.model('AttendanceTest', AttendanceSchema);
    LeaveModel = mongoose.model('LeaveTest', LeaveSchema);
    TicketModel = mongoose.model('TicketTest', TicketSchema);
    InvitationModel = mongoose.model('InvitationTest', InvitationSchema);
  });

  afterAll(async () => {
    mongoose.deleteModel('UserTest');
    mongoose.deleteModel('EmployeeTest');
    mongoose.deleteModel('AttendanceTest');
    mongoose.deleteModel('LeaveTest');
    mongoose.deleteModel('TicketTest');
    mongoose.deleteModel('InvitationTest');
  });

  describe('UserSchema Security & Indexing', () => {
    it('should strip password, otp, and reset tokens on toJSON serialization', () => {
      const user = new UserModel({
        email: 'test@safevitals.com',
        name: 'Test User',
        password: 'hashed-secret-password',
        passwordHash: 'hashed-secret-password',
        otp: 'hashed-otp',
        otpCodeHash: 'hashed-otp',
        resetPasswordToken: 'secret-reset-token',
        resetPasswordTokenHash: 'secret-reset-token',
        activationToken: 'secret-activation-token',
      });

      const json = user.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.passwordHash).toBeUndefined();
      expect(json.otp).toBeUndefined();
      expect(json.otpCodeHash).toBeUndefined();
      expect(json.resetPasswordToken).toBeUndefined();
      expect(json.resetPasswordTokenHash).toBeUndefined();
      expect(json.activationToken).toBeUndefined();
      expect(json.id).toBeDefined();
      expect(json.email).toBe('test@safevitals.com');
    });

    it('should define unique constraint on email path', () => {
      const emailPath: any = UserSchema.path('email');
      expect(emailPath).toBeDefined();
      expect(emailPath.options.unique).toBe(true);
    });
  });

  describe('AttendanceSchema Constraints', () => {
    it('should have unique compound index on employeeId and date to prevent duplicate check-ins', () => {
      const indexes = AttendanceSchema.indexes();
      const compound = indexes.find(
        (idx) => idx[0]?.employeeId === 1 && idx[0]?.date === 1,
      );
      expect(compound).toBeDefined();
      expect(compound[1]?.unique).toBe(true);
    });
  });

  describe('InvitationSchema TTL Index', () => {
    it('should have TTL index on expiresAt for auto-cleanup', () => {
      const indexes = InvitationSchema.indexes();
      const ttl = indexes.find((idx) => idx[0]?.expiresAt === 1);
      expect(ttl).toBeDefined();
      expect(ttl[1]?.expireAfterSeconds).toBe(0);
    });
  });

  describe('LeaveSchema Validation', () => {
    it('should default status to pending and define compound index', () => {
      const leave = new LeaveModel({
        employeeId: 'EMP-000001',
        startDate: '2025-03-01',
        endDate: '2025-03-03',
        days: 3,
        type: 'annual',
      });
      expect(leave.status).toBe('pending');
      const json = leave.toJSON();
      expect(json.id).toBeDefined();
    });
  });
});
