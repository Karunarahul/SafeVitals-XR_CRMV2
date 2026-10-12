import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserStatus } from '../users/schemas/user.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { Role } from '../roles/schemas/role.schema';
import { Invitation } from '../employees/schemas/invitation.schema';
import { MailService } from '../mail/mail.service';
import { ThrottlerModule } from '@nestjs/throttler';

describe('Authentication Module (Integration)', () => {
  let app: INestApplication;
  let authController: AuthController;

  // In-memory mock database state
  const usersStore = new Map<string, any>();
  const employeesStore = new Map<string, any>();
  const rolesStore = new Map<string, any>();
  const invitationsStore = new Map<string, any>();

  // Mock Mailer recorder
  const sentEmails: Array<{ to: string; subject?: string; code?: string; purpose?: string }> = [];

  const mockMailService = {
    sendOtpEmail: jest.fn().mockImplementation(async (to: string, otp: string, purpose: string) => {
      sentEmails.push({ to, code: otp, purpose });
      return true;
    }),
    sendPasswordResetEmail: jest.fn().mockImplementation(async (to: string, resetToken: string) => {
      sentEmails.push({ to, code: resetToken, purpose: 'PasswordReset' });
      return true;
    }),
    sendInvitationEmail: jest.fn().mockImplementation(async (to: string, inviteToken: string, name: string) => {
      sentEmails.push({ to, code: inviteToken, purpose: 'Invitation' });
      return true;
    }),
  };

  const createMockQuery = (result: any) => {
    const query: any = {
      select: jest.fn().mockImplementation(() => query),
      lean: jest.fn().mockImplementation(() => Promise.resolve(result)),
      then: (resolve: any) => resolve(result),
    };
    return query;
  };

  const mockUserModel = {
    findOne: jest.fn().mockImplementation((filter: any) => {
      for (const user of usersStore.values()) {
        if (filter.email && user.email === filter.email.toLowerCase()) {
          return createMockQuery(user);
        }
        if (filter._id && user._id === filter._id) {
          return createMockQuery(user);
        }
        if (filter.registrationToken && user.registrationToken === filter.registrationToken) {
          return createMockQuery(user);
        }
        if (filter.$or) {
          for (const cond of filter.$or) {
            if (cond.resetPasswordToken && user.resetPasswordToken === cond.resetPasswordToken) {
              return createMockQuery(user);
            }
            if (cond.resetPasswordTokenHash && user.resetPasswordTokenHash === cond.resetPasswordTokenHash) {
              return createMockQuery(user);
            }
            if (cond.activationToken && user.activationToken === cond.activationToken) {
              return createMockQuery(user);
            }
          }
        }
      }
      return createMockQuery(null);
    }),
    findById: jest.fn().mockImplementation((id: string) => {
      const user = usersStore.get(id);
      return createMockQuery(user || null);
    }),
    create: jest.fn().mockImplementation(async (data: any) => {
      const id = data._id || `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const doc: any = {
        _id: id,
        id,
        ...data,
        save: jest.fn().mockImplementation(async function () {
          usersStore.set(id, this);
          return this;
        }),
        toObject: function () {
          return { ...this };
        },
      };
      usersStore.set(id, doc);
      return doc;
    }),
  };

  const mockEmployeeModel = {
    findOne: jest.fn().mockImplementation((filter: any) => {
      for (const emp of employeesStore.values()) {
        if (filter.userId && emp.userId === filter.userId) {
          return createMockQuery(emp);
        }
      }
      return createMockQuery(null);
    }),
    findById: jest.fn().mockImplementation((id: string) => {
      const emp = employeesStore.get(id);
      return createMockQuery(emp || null);
    }),
    findByIdAndUpdate: jest.fn().mockImplementation(async (id: string, update: any) => {
      const emp = employeesStore.get(id);
      if (emp) {
        Object.assign(emp, update);
        employeesStore.set(id, emp);
      }
      return emp;
    }),
    create: jest.fn().mockImplementation(async (data: any) => {
      const id = data._id || `emp_${Date.now()}`;
      const doc = { _id: id, id, ...data };
      employeesStore.set(id, doc);
      return doc;
    }),
  };

  const mockRoleModel = {
    findOne: jest.fn().mockImplementation((filter: any) => {
      for (const role of rolesStore.values()) {
        if (filter.name && role.name === filter.name) {
          return createMockQuery(role);
        }
      }
      return createMockQuery(null);
    }),
    findById: jest.fn().mockImplementation((id: string) => {
      const role = rolesStore.get(id);
      return createMockQuery(role || null);
    }),
  };

  const mockInvitationModel = {
    findOne: jest.fn().mockImplementation((filter: any) => {
      for (const invite of invitationsStore.values()) {
        if (filter.token && invite.token === filter.token) {
          if (filter.status?.$in && !filter.status.$in.includes(invite.status)) {
            continue;
          }
          const doc: any = {
            ...invite,
            save: jest.fn().mockImplementation(async function () {
              invitationsStore.set(invite.id, this);
              return this;
            }),
          };
          return createMockQuery(doc);
        }
      }
      return createMockQuery(null);
    }),
  };

  beforeAll(async () => {
    // Seed default role in in-memory test store
    rolesStore.set('role_employee', {
      _id: 'role_employee',
      name: 'Employee',
      permissions: ['attendance.read', 'leave.write'],
    });

    rolesStore.set('role_super_admin', {
      _id: 'role_super_admin',
      name: 'Super Admin',
      permissions: ['*.*.*'],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-jwt-secret-key-32chars-long-minimum',
          signOptions: { expiresIn: '1d' },
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Employee.name), useValue: mockEmployeeModel },
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
        { provide: getModelToken(Invitation.name), useValue: mockInvitationModel },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    authController = moduleFixture.get<AuthController>(AuthController);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Registration & Onboarding Flow', () => {
    let registrationToken: string;
    const candidateEmail = 'candidate.priya@safevitals.com';

    it('Step 1: POST /auth/register accepts candidate details and sends OTP', async () => {
      const res = await authController.register({
        fullName: 'Priya Sharma',
        email: candidateEmail,
        phone: '+919876543210',
      });

      expect(res.success).toBe(true);
      expect(res.registrationToken).toBeDefined();
      expect(res.registrationToken.startsWith('reg_tok_')).toBe(true);
      expect(res.message).toContain('Verification code sent');

      registrationToken = res.registrationToken;

      // Verify email dispatch
      expect(mockMailService.sendOtpEmail).toHaveBeenCalledWith(
        candidateEmail,
        expect.stringMatching(/^\d{6}$/),
        'Registration',
      );
      const email = sentEmails.find((e) => e.to === candidateEmail && e.purpose === 'Registration');
      expect(email).toBeDefined();
    });

    it('Step 2: Reject duplicate registration attempts safely', async () => {
      const activeEmail = 'active.user@safevitals.com';
      await mockUserModel.create({
        email: activeEmail,
        status: UserStatus.ACTIVE,
        name: 'Active User',
      });

      await expect(
        authController.register({
          fullName: 'Duplicate Candidate',
          email: activeEmail,
          phone: '+919999999999',
        }),
      ).rejects.toThrow('An account with this email address already exists');
    });

    it('Step 3: Reject registration verify with invalid OTP', async () => {
      await expect(
        authController.verifyRegisterOtp({
          registrationToken,
          otp: '000000',
          password: 'SecurePassword123!',
        }),
      ).rejects.toThrow('Invalid verification code');
    });

    it('Step 4: POST /auth/register/verify-otp verifies OTP, sets password, preserves Pending status', async () => {
      const emailEntry = sentEmails.find((e) => e.to === candidateEmail && e.purpose === 'Registration');
      expect(emailEntry).toBeDefined();
      const dispatchedOtp = emailEntry!.code!;

      const res = await authController.verifyRegisterOtp({
        registrationToken,
        otp: dispatchedOtp,
        password: 'PermanentPassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.pendingOnboarding).toBe(true);
      expect(res.message).toContain('pending administrator approval');

      // Verify user state in database
      const user = await mockUserModel.findOne({ email: candidateEmail });
      expect(user.status).toBe(UserStatus.PENDING);
      expect(user.isEmailVerified).toBe(true);
      expect(user.password).toBeDefined();

      // Ensure OTP was cleared to prevent reuse
      expect(user.otp).toBeUndefined();
    });
  });

  describe('Login Flow & Two-Factor Authentication', () => {
    const twoFactorEmail = 'architect@safevitals.com';
    const directLoginEmail = 'doctor@safevitals.com';
    let twoFactorUserId: string;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('SecurePassword123!', 10);

      // Create user with 2FA enabled
      const user2FA = await mockUserModel.create({
        email: twoFactorEmail,
        password: passwordHash,
        passwordHash,
        name: 'Spatial Architect',
        status: UserStatus.ACTIVE,
        isTwoFactorEnabled: true,
        twoFactorEnabled: true,
        role: 'Employee',
      });
      twoFactorUserId = user2FA._id;

      // Create user without 2FA enabled
      await mockUserModel.create({
        email: directLoginEmail,
        password: passwordHash,
        passwordHash,
        name: 'Clinical Specialist',
        status: UserStatus.ACTIVE,
        isTwoFactorEnabled: false,
        twoFactorEnabled: false,
        role: 'Employee',
      });
    });

    it('Step 1: Reject unapproved pending user from logging in', async () => {
      await expect(
        authController.login({
          email: 'candidate.priya@safevitals.com',
          password: 'PermanentPassword123!',
        }),
      ).rejects.toThrow('Your account is pending administrator approval');
    });

    it('Step 2: Reject invalid password with generic error message', async () => {
      await expect(
        authController.login({
          email: directLoginEmail,
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('Step 3: Direct login succeeds when 2FA is not required', async () => {
      const res = await authController.login({
        email: directLoginEmail,
        password: 'SecurePassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.token).toBeDefined();
      expect(res.user).toBeDefined();
      expect(res.user.email).toBe(directLoginEmail);
      expect(res.mustChangePassword).toBe(false);
    });

    it('Step 4: 2FA login initiates OTP dispatch and returns userId', async () => {
      const res = await authController.login({
        email: twoFactorEmail,
        password: 'SecurePassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.userId).toBe(twoFactorUserId);
      expect(res.requiresTwoFactor).toBe(true);
      expect(res.message).toContain('OTP sent');
      expect(mockMailService.sendOtpEmail).toHaveBeenCalledWith(
        twoFactorEmail,
        expect.stringMatching(/^\d{6}$/),
        'Two-Factor Login',
      );
    });

    it('Step 5: Verify login OTP rejects invalid code and enforces attempt limit', async () => {
      await expect(
        authController.verifyOtp({
          userId: twoFactorUserId,
          otp: '111111',
        }),
      ).rejects.toThrow('Invalid verification code');

      const user = await mockUserModel.findById(twoFactorUserId);
      expect(user.otpAttempts).toBe(1);
    });

    it('Step 6: POST /auth/verify-otp completes login and issues JWT', async () => {
      const emailEntry = sentEmails.find((e) => e.to === twoFactorEmail && e.purpose === 'Two-Factor Login');
      expect(emailEntry).toBeDefined();
      const latestOtp = emailEntry!.code!;

      const res = await authController.verifyOtp({
        userId: twoFactorUserId,
        otp: latestOtp,
      });

      expect(res.success).toBe(true);
      expect(res.token).toBeDefined();
      expect(res.user).toBeDefined();
      expect(res.user.id).toBe(twoFactorUserId);
      expect(res.user.email).toBe(twoFactorEmail);
      expect(Array.isArray(res.user.permissions)).toBe(true);

      // Verify OTP reuse prevention
      const userAfter = await mockUserModel.findById(twoFactorUserId);
      expect(userAfter.otp).toBeUndefined();

      // Test reusing the same OTP
      await expect(
        authController.verifyOtp({
          userId: twoFactorUserId,
          otp: latestOtp,
        }),
      ).rejects.toThrow('No pending OTP request found');
    });

    it('Step 7: POST /auth/resend-otp generates fresh OTP', async () => {
      const res = await authController.resendOtp({
        userId: twoFactorUserId,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('new verification code has been dispatched');
      expect(mockMailService.sendOtpEmail).toHaveBeenCalled();
    });
  });

  describe('Password Management & Recovery', () => {
    const resetEmail = 'recovery.user@safevitals.com';
    let userId: string;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('InitialPassword123!', 10);
      const user = await mockUserModel.create({
        email: resetEmail,
        password: passwordHash,
        passwordHash,
        name: 'Recovery User',
        status: UserStatus.ACTIVE,
        role: 'Employee',
      });
      userId = user._id;
    });

    it('Forgot password anti-enumeration: returns identical success for arbitrary emails', async () => {
      const resReal = await authController.forgotPassword({ email: resetEmail });
      expect(resReal.success).toBe(true);
      expect(resReal.message).toContain('password reset link has been dispatched');

      const resFake = await authController.forgotPassword({ email: 'ghost.nobody@safevitals.com' });
      expect(resFake.success).toBe(true);
      expect(resFake.message).toContain('password reset link has been dispatched');
    });

    it('Reset password updates password using valid reset token', async () => {
      const resetEmailEntry = sentEmails.find((e) => e.to === resetEmail && e.purpose === 'PasswordReset');
      expect(resetEmailEntry).toBeDefined();
      const rawToken = resetEmailEntry!.code!;

      const res = await authController.resetPassword({
        token: rawToken,
        password: 'BrandNewSecurePassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('successfully reset');

      // Verify new password works
      const user = await mockUserModel.findOne({ email: resetEmail });
      const matches = await bcrypt.compare('BrandNewSecurePassword123!', user.password);
      expect(matches).toBe(true);
    });

    it('Change password updates password when authenticated', async () => {
      const res = await authController.changePassword(userId, {
        currentPassword: 'BrandNewSecurePassword123!',
        newPassword: 'EvenMoreSecurePassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Password updated successfully');
    });
  });

  describe('Account Activation (Setup Password)', () => {
    const inviteToken = 'invite_test_secret_tok_999';
    const invitedEmail = 'invited.engineer@safevitals.com';

    beforeAll(async () => {
      const empId = 'emp_invited_01';
      employeesStore.set(empId, {
        _id: empId,
        id: empId,
        email: invitedEmail,
        status: 'Pending',
      });

      invitationsStore.set('inv_01', {
        id: 'inv_01',
        email: invitedEmail,
        employeeId: empId,
        token: inviteToken,
        status: 'Sent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await mockUserModel.create({
        email: invitedEmail,
        name: 'Invited Engineer',
        status: UserStatus.PENDING,
        role: 'Employee',
        employeeDocId: empId,
      });
    });

    it('POST /auth/setup-password activates invited account and issues JWT', async () => {
      const res = await authController.setupPassword({
        invitationToken: inviteToken,
        password: 'ActivatedPermanentPassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Account successfully activated');
      expect(res.token).toBeDefined();
      expect(res.user.status).toBe(UserStatus.ACTIVE);

      // Verify employee was also activated
      const emp = employeesStore.get('emp_invited_01');
      expect(emp.status).toBe('Active');
    });
  });

  describe('Session Profile & Logout', () => {
    it('GET /auth/me returns authenticated profile', async () => {
      const user = await mockUserModel.create({
        email: 'profile.test@safevitals.com',
        name: 'Profile Tester',
        status: UserStatus.ACTIVE,
        role: 'Super Admin',
        isSuperAdmin: true,
      });

      const res = await authController.getProfile(user._id);
      expect(res.success).toBe(true);
      expect(res.user.email).toBe('profile.test@safevitals.com');
      expect(res.user.permissions).toContain('*.*.*');
    });

    it('POST /auth/logout invalidates session', async () => {
      const res = authController.logout();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Logged out successfully');
    });
  });
});
