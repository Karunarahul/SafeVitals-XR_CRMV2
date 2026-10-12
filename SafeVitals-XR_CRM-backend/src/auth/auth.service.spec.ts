import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { User, UserStatus } from '../users/schemas/user.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { Role } from '../roles/schemas/role.schema';
import { Invitation } from '../employees/schemas/invitation.schema';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserModel: any;
  let mockEmployeeModel: any;
  let mockRoleModel: any;
  let mockInvitationModel: any;
  let mockJwtService: any;
  let mockMailService: any;

  beforeEach(async () => {
    mockUserModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    mockEmployeeModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn(),
    };
    mockRoleModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: 'Employee', permissions: ['attendance.read'] }) }),
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: 'Employee', permissions: ['attendance.read'] }) }),
    };
    mockInvitationModel = {
      findOne: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };
    mockMailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
      sendInvitationEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Employee.name), useValue: mockEmployeeModel },
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
        { provide: getModelToken(Invitation.name), useValue: mockInvitationModel },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.login({ email: 'nonexistent@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully log in directly when 2FA is not enabled', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@example.com',
        password: hashedPassword,
        name: 'Test User',
        role: 'Employee',
        status: UserStatus.ACTIVE,
        isTwoFactorEnabled: false,
        save: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          _id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          name: 'Test User',
          role: 'Employee',
          status: 'Active',
        }),
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      mockEmployeeModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ employeeId: 'EMP-000001' }),
        }),
      });

      const result = await service.login({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('user@example.com');
    });

    it('should trigger 2FA OTP flow if isTwoFactorEnabled is true', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@example.com',
        password: hashedPassword,
        name: 'Test User',
        role: 'Employee',
        status: UserStatus.ACTIVE,
        isTwoFactorEnabled: true,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.login({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.userId).toBe('507f1f77bcf86cd799439011');
      expect(mockMailService.sendOtpEmail).toHaveBeenCalled();
    });

    it('should reject login if account is pending administrator approval', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'candidate@example.com',
        password: hashedPassword,
        name: 'Candidate User',
        role: 'Employee',
        status: UserStatus.PENDING,
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        service.login({ email: 'candidate@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('registration', () => {
    it('should initiate candidate registration and dispatch OTP', async () => {
      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      mockUserModel.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        email: 'candidate@safevitals.com',
      });

      const res = await service.register({
        fullName: 'Candidate Name',
        email: 'candidate@safevitals.com',
        phone: '+919876543210',
      });

      expect(res.success).toBe(true);
      expect(res.registrationToken).toBeDefined();
      expect(res.registrationToken.startsWith('reg_tok_')).toBe(true);
      expect(mockMailService.sendOtpEmail).toHaveBeenCalledWith(
        'candidate@safevitals.com',
        expect.any(String),
        'Registration',
      );
    });

    it('should verify registration OTP and set account password while preserving pending status', async () => {
      const hashedOtp = await bcrypt.hash('654321', 8);
      const mockPendingUser: any = {
        _id: '507f1f77bcf86cd799439012',
        email: 'candidate@safevitals.com',
        otp: hashedOtp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        registrationTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        status: UserStatus.PENDING,
        isEmailVerified: false,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockPendingUser),
      });

      const res = await service.verifyRegisterOtp({
        registrationToken: 'reg_tok_valid_test_token',
        otp: '654321',
        password: 'PermanentPassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.pendingOnboarding).toBe(true);
      expect(mockPendingUser.status).toBe(UserStatus.PENDING);
      expect(mockPendingUser.isEmailVerified).toBe(true);
      expect(mockPendingUser.save).toHaveBeenCalled();
    });
  });

  describe('verifyLoginOtp', () => {
    it('should verify 2FA OTP and issue JWT session', async () => {
      const hashedOtp = await bcrypt.hash('123456', 8);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@example.com',
        name: 'Test User',
        role: 'Employee',
        status: UserStatus.ACTIVE,
        otp: hashedOtp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      mockEmployeeModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ employeeId: 'EMP-000001' }),
        }),
      });

      const res = await service.verifyLoginOtp({
        userId: '507f1f77bcf86cd799439011',
        otp: '123456',
      });

      expect(res.success).toBe(true);
      expect(res.token).toBe('mock-jwt-token');
      expect(res.user.id).toBe('507f1f77bcf86cd799439011');
      expect(mockUser.otp).toBeUndefined();
    });

    it('should reject invalid OTP code and increment attempts', async () => {
      const hashedOtp = await bcrypt.hash('123456', 8);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        otp: hashedOtp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 1,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        service.verifyLoginOtp({
          userId: '507f1f77bcf86cd799439011',
          otp: '999999',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockUser.otpAttempts).toBe(2);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('password management', () => {
    it('should handle forgot password without revealing existence of unmapped email', async () => {
      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await service.forgotPassword({ email: 'unknown@example.com' });
      expect(res.success).toBe(true);
      expect(res.message).toContain('If an account exists');
    });

    it('should change password successfully when current password matches', async () => {
      const hashedPassword = await bcrypt.hash('OldPassword123!', 10);
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        password: hashedPassword,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await service.changePassword('507f1f77bcf86cd799439011', {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });

      expect(res.success).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
