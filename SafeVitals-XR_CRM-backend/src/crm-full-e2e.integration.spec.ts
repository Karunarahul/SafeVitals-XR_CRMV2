import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

// Controllers
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { EmployeesController } from './employees/employees.controller';
import { DepartmentsController } from './departments/departments.controller';
import { TeamsController } from './teams/teams.controller';
import { PositionsController } from './positions/positions.controller';
import { RolesController } from './roles/roles.controller';
import { AttendanceController } from './attendance/attendance.controller';
import { LeaveController } from './leave/leave.controller';
import { SchedulesController } from './schedules/schedules.controller';
import { TasksController } from './tasks/tasks.controller';
import { TicketsController } from './tickets/tickets.controller';
import { ReportsController } from './reports/reports.controller';
import { AccessRequestsController } from './access-requests/access-requests.controller';
import { AuditController } from './audit/audit.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { OrgSettingsController } from './org-settings/org-settings.controller';

// Services
import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { EmployeesService } from './employees/employees.service';
import { DepartmentsService } from './departments/departments.service';
import { TeamsService } from './teams/teams.service';
import { PositionsService } from './positions/positions.service';
import { RolesService } from './roles/roles.service';
import { AttendanceService } from './attendance/attendance.service';
import { LeaveService } from './leave/leave.service';
import { SchedulesService } from './schedules/schedules.service';
import { TasksService } from './tasks/tasks.service';
import { TicketsService } from './tickets/tickets.service';
import { ReportsService } from './reports/reports.service';
import { AccessRequestsService } from './access-requests/access-requests.service';
import { AuditService } from './audit/audit.service';
import { NotificationsService } from './notifications/notifications.service';
import { OrgSettingsService } from './org-settings/org-settings.service';
import { SequenceService } from './database/sequence.service';
import { ReferenceValidatorService } from './database/reference-validator.service';
import { MailService } from './mail/mail.service';

// Schemas
import { User, UserStatus } from './users/schemas/user.schema';
import { Employee } from './employees/schemas/employee.schema';
import { Invitation } from './employees/schemas/invitation.schema';
import { Department } from './departments/schemas/department.schema';
import { Team } from './teams/schemas/team.schema';
import { Position } from './positions/schemas/position.schema';
import { Role } from './roles/schemas/role.schema';
import { Attendance } from './attendance/schemas/attendance.schema';
import { Leave } from './leave/schemas/leave.schema';
import { Schedule } from './schedules/schemas/schedule.schema';
import { Task } from './tasks/schemas/task.schema';
import { Ticket } from './tickets/schemas/ticket.schema';
import { Report } from './reports/schemas/report.schema';
import { AccessRequest } from './access-requests/schemas/access-request.schema';
import { AuditLog } from './audit/schemas/audit-log.schema';
import { Notification } from './notifications/schemas/notification.schema';
import { OrgSettings } from './org-settings/schemas/org-settings.schema';

import { CurrentUserPayload } from './common/interfaces/current-user.interface';

describe('SafeVitals XR CRM - Full E2E Integration Suite', () => {
  let authController: AuthController;
  let authService: AuthService;
  let usersController: UsersController;
  let employeesController: EmployeesController;
  let departmentsController: DepartmentsController;
  let teamsController: TeamsController;
  let positionsController: PositionsController;
  let rolesController: RolesController;
  let attendanceController: AttendanceController;
  let leaveController: LeaveController;
  let schedulesController: SchedulesController;
  let tasksController: TasksController;
  let ticketsController: TicketsController;
  let reportsController: ReportsController;
  let accessRequestsController: AccessRequestsController;
  let auditController: AuditController;
  let notificationsController: NotificationsController;
  let notificationsService: NotificationsService;
  let orgSettingsController: OrgSettingsController;
  let mailService: MailService;

  const usersStore = new Map<string, any>();
  const employeesStore = new Map<string, any>();
  const departmentsStore = new Map<string, any>();
  const teamsStore = new Map<string, any>();
  const positionsStore = new Map<string, any>();
  const rolesStore = new Map<string, any>();
  const attendanceStore = new Map<string, any>();
  const leaveStore = new Map<string, any>();
  const schedulesStore = new Map<string, any>();
  const tasksStore = new Map<string, any>();
  const ticketsStore = new Map<string, any>();
  const reportsStore = new Map<string, any>();
  const accessRequestsStore = new Map<string, any>();
  const auditLogsStore = new Map<string, any>();
  const notificationsStore = new Map<string, any>();
  const orgSettingsStore = new Map<string, any>();
  const invitationsStore = new Map<string, any>();

  const createMockModel = (store: Map<string, any>) => {
    const createMockQuery = (result: any) => {
      const query: any = {
        populate: jest.fn().mockImplementation(() => query),
        select: jest.fn().mockImplementation(() => query),
        sort: jest.fn().mockImplementation(() => query),
        limit: jest.fn().mockImplementation(() => query),
        skip: jest.fn().mockImplementation(() => query),
        lean: jest.fn().mockImplementation(() => Promise.resolve(result)),
        then: (resolve: any) => resolve(result),
      };
      return query;
    };

    const matchesFilter = (item: any, filter?: any): boolean => {
      if (!filter || Object.keys(filter).length === 0) return true;
      for (const [key, val] of Object.entries(filter)) {
        if (key === '$or' && Array.isArray(val)) {
          const matchedAny = val.some((sub) => matchesFilter(item, sub));
          if (!matchedAny) return false;
          continue;
        }
        if (val && typeof val === 'object' && !(val instanceof Date) && !(val instanceof Types.ObjectId)) {
          if ('$gt' in val) {
            if (!(new Date(item[key]) > new Date((val as any).$gt))) return false;
          } else if ('$gte' in val) {
            if (!(new Date(item[key]) >= new Date((val as any).$gte))) return false;
          } else if ('$in' in val) {
            if (!((val as any).$in.map((x: any) => x?.toString()).includes(item[key]?.toString()))) return false;
          }
        } else if (val !== undefined) {
          const itemVal = item[key];
          const filterVal = val;
          if (itemVal?.toString() !== filterVal?.toString()) return false;
        }
      }
      return true;
    };

    return {
      find: jest.fn().mockImplementation((filter?: any) => {
        const items = Array.from(store.values()).filter((item) => matchesFilter(item, filter));
        return createMockQuery(items);
      }),
      findById: jest.fn().mockImplementation((id: string) => {
        const item = store.get(id?.toString());
        if (!item) return createMockQuery(null);
        const doc = {
          ...item,
          save: jest.fn().mockImplementation(async function () {
            store.set(id.toString(), this);
            return this;
          }),
          toObject: function () {
            return { ...this };
          },
        };
        return createMockQuery(doc);
      }),
      findOne: jest.fn().mockImplementation((filter?: any) => {
        for (const item of store.values()) {
          if (matchesFilter(item, filter)) {
            const doc = {
              ...item,
              save: jest.fn().mockImplementation(async function () {
                store.set(item._id.toString(), this);
                return this;
              }),
              toObject: function () {
                return { ...this };
              },
            };
            return createMockQuery(doc);
          }
        }
        return createMockQuery(null);
      }),
      create: jest.fn().mockImplementation(async (data: any) => {
        const id = data._id || new Types.ObjectId().toString();
        const doc = {
          _id: new Types.ObjectId(id),
          id: id.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data,
          save: jest.fn().mockImplementation(async function () {
            store.set(id.toString(), this);
            return this;
          }),
          toObject: function () {
            return { ...this };
          },
        };
        store.set(id.toString(), doc);
        return doc;
      }),
      findByIdAndUpdate: jest.fn().mockImplementation((id: string, update: any) => {
        const item = store.get(id?.toString());
        if (!item) return createMockQuery(null);
        const updated = { ...item, ...(update.$set || update) };
        store.set(id.toString(), updated);
        return createMockQuery(updated);
      }),
      findOneAndUpdate: jest.fn().mockImplementation((filter: any, update: any) => {
        let targetId = filter?._id?.toString();
        if (!targetId) {
          for (const item of store.values()) {
            if (matchesFilter(item, filter)) {
              targetId = item._id.toString();
              break;
            }
          }
        }
        if (!targetId) {
          const first = Array.from(store.values())[0];
          targetId = first ? first._id?.toString() : undefined;
        }
        if (!targetId) return createMockQuery(null);
        const item = store.get(targetId);
        const updated = { ...item, ...(update.$set || update) };
        store.set(targetId, updated);
        return createMockQuery(updated);
      }),
      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        for (const [id, item] of store.entries()) {
          if (matchesFilter(item, filter)) {
            store.set(id, { ...item, ...(update.$set || update) });
          }
        }
        return Promise.resolve({ modifiedCount: store.size });
      }),
      findByIdAndDelete: jest.fn().mockImplementation((id: string) => {
        const item = store.get(id?.toString());
        store.delete(id?.toString());
        return createMockQuery(item || null);
      }),
      countDocuments: jest.fn().mockImplementation(() => Promise.resolve(store.size)),
    };
  };

  let adminUser: any;
  let adminPayload: CurrentUserPayload;

  beforeAll(async () => {
    const superAdminRole = {
      _id: new Types.ObjectId(),
      name: 'Super Admin',
      description: 'System owner',
      permissions: ['*'],
      isSystem: true,
    };
    rolesStore.set(superAdminRole._id.toString(), superAdminRole);

    const hashedOld = await bcrypt.hash('OldPassword123!', 10);
    adminUser = {
      _id: new Types.ObjectId(),
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@safevitals.com',
      role: 'Super Admin',
      roleId: superAdminRole._id,
      status: UserStatus.ACTIVE,
      passwordHash: hashedOld,
      password: hashedOld,
      is2faEnabled: false,
      save: jest.fn().mockResolvedValue(true),
    };
    usersStore.set(adminUser._id.toString(), adminUser);

    adminPayload = {
      userId: adminUser._id.toString(),
      email: adminUser.email,
      role: 'Super Admin',
      roleId: superAdminRole._id.toString(),
      permissions: ['*'],
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        EmployeesController,
        DepartmentsController,
        TeamsController,
        PositionsController,
        RolesController,
        AttendanceController,
        LeaveController,
        SchedulesController,
        TasksController,
        TicketsController,
        ReportsController,
        AccessRequestsController,
        AuditController,
        NotificationsController,
        OrgSettingsController,
      ],
      providers: [
        AuthService,
        UsersService,
        EmployeesService,
        DepartmentsService,
        TeamsService,
        PositionsService,
        RolesService,
        AttendanceService,
        LeaveService,
        SchedulesService,
        TasksService,
        TicketsService,
        ReportsService,
        AccessRequestsService,
        AuditService,
        NotificationsService,
        OrgSettingsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'jwt.secret': 'super-test-jwt-secret-key-32chars',
                'jwt.accessExpiration': '15m',
                'jwt.refreshExpiration': '7d',
              };
              return config[key] !== undefined ? config[key] : defaultValue;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'test-jwt-access-token'),
            signAsync: jest.fn().mockResolvedValue('test-jwt-access-token'),
            verify: jest.fn(() => ({ sub: adminUser._id.toString(), email: adminUser.email })),
            verifyAsync: jest.fn().mockResolvedValue({ sub: adminUser._id.toString(), email: adminUser.email }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendOtpEmail: jest.fn().mockResolvedValue(true),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
            sendAccountApprovalEmail: jest.fn().mockResolvedValue(true),
            sendWelcomeEmail: jest.fn().mockResolvedValue(true),
            sendInvitationEmail: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: SequenceService,
          useValue: {
            getNextEmployeeId: jest.fn().mockResolvedValue('SV-001'),
            getNextSequence: jest.fn().mockResolvedValue(101),
          },
        },
        {
          provide: ReferenceValidatorService,
          useValue: {
            validateDepartment: jest.fn().mockResolvedValue(new Types.ObjectId()),
            validatePosition: jest.fn().mockResolvedValue(new Types.ObjectId()),
            validateTeam: jest.fn().mockResolvedValue(new Types.ObjectId()),
            validateUser: jest.fn().mockResolvedValue(new Types.ObjectId()),
            validateEmployee: jest.fn().mockResolvedValue(new Types.ObjectId()),
            validateRole: jest.fn().mockResolvedValue({ id: superAdminRole._id, name: 'Super Admin' }),
          },
        },
        { provide: getModelToken(User.name), useValue: createMockModel(usersStore) },
        { provide: getModelToken(Employee.name), useValue: createMockModel(employeesStore) },
        { provide: getModelToken(Invitation.name), useValue: createMockModel(invitationsStore) },
        { provide: getModelToken(Department.name), useValue: createMockModel(departmentsStore) },
        { provide: getModelToken(Team.name), useValue: createMockModel(teamsStore) },
        { provide: getModelToken(Position.name), useValue: createMockModel(positionsStore) },
        { provide: getModelToken(Role.name), useValue: createMockModel(rolesStore) },
        { provide: getModelToken(Attendance.name), useValue: createMockModel(attendanceStore) },
        { provide: getModelToken(Leave.name), useValue: createMockModel(leaveStore) },
        { provide: getModelToken(Schedule.name), useValue: createMockModel(schedulesStore) },
        { provide: getModelToken(Task.name), useValue: createMockModel(tasksStore) },
        { provide: getModelToken(Ticket.name), useValue: createMockModel(ticketsStore) },
        { provide: getModelToken(Report.name), useValue: createMockModel(reportsStore) },
        { provide: getModelToken(AccessRequest.name), useValue: createMockModel(accessRequestsStore) },
        { provide: getModelToken(AuditLog.name), useValue: createMockModel(auditLogsStore) },
        { provide: getModelToken(Notification.name), useValue: createMockModel(notificationsStore) },
        { provide: getModelToken(OrgSettings.name), useValue: createMockModel(orgSettingsStore) },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    usersController = module.get<UsersController>(UsersController);
    employeesController = module.get<EmployeesController>(EmployeesController);
    departmentsController = module.get<DepartmentsController>(DepartmentsController);
    teamsController = module.get<TeamsController>(TeamsController);
    positionsController = module.get<PositionsController>(PositionsController);
    rolesController = module.get<RolesController>(RolesController);
    attendanceController = module.get<AttendanceController>(AttendanceController);
    leaveController = module.get<LeaveController>(LeaveController);
    schedulesController = module.get<SchedulesController>(SchedulesController);
    tasksController = module.get<TasksController>(TasksController);
    ticketsController = module.get<TicketsController>(TicketsController);
    reportsController = module.get<ReportsController>(ReportsController);
    accessRequestsController = module.get<AccessRequestsController>(AccessRequestsController);
    auditController = module.get<AuditController>(AuditController);
    notificationsController = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    orgSettingsController = module.get<OrgSettingsController>(OrgSettingsController);
    mailService = module.get<MailService>(MailService);
  });

  describe('TASK 2 & 5: Authentication Lifecycle & User Approval', () => {
    let registrationToken: string;
    let registeredUserId: string;

    it('Step 1: Should register a new user and generate registration token', async () => {
      const regRes = await authController.register({
        fullName: 'Jane Doe',
        email: 'jane@safevitals.com',
        phone: '+919876543210',
      });
      expect(regRes).toHaveProperty('registrationToken');
      expect(regRes.success).toBe(true);
      registrationToken = regRes.registrationToken;
    });

    it('Step 2: Should verify registration OTP and place account in PENDING state', async () => {
      const sentOtp = (mailService.sendOtpEmail as jest.Mock).mock.calls[0][1];

      const verifyRes = await authController.verifyRegisterOtp({
        registrationToken,
        otp: sentOtp,
        password: 'InitialPassword123!',
      });
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.pendingOnboarding).toBe(true);

      const userDoc = Array.from(usersStore.values()).find((u) => u.email === 'jane@safevitals.com');
      expect(userDoc).toBeDefined();
      expect(userDoc.status).toBe(UserStatus.PENDING);
      registeredUserId = userDoc._id.toString();
    });

    it('Step 3: Admin should list pending users and approve registration', async () => {
      const pendingUsers = await usersController.findPending();
      expect(pendingUsers.some((u) => u.email === 'jane@safevitals.com')).toBe(true);

      const roles = await rolesController.findAll();
      const approveRes = await usersController.approveCandidate(
        registeredUserId,
        {
          roleId: roles[0]._id.toString(),
        },
        adminPayload,
      );
      expect(approveRes.success).toBe(true);
      expect(approveRes.user.status).toBe(UserStatus.ACTIVE);
    });

    it('Step 4: Approved user can log in and retrieve tokens via login OTP', async () => {
      const loginRes = await authController.login({
        email: 'jane@safevitals.com',
        password: 'InitialPassword123!',
      });
      expect(loginRes).toBeDefined();

      if (loginRes.requiresTwoFactor) {
        const verifyOtpRes = await authController.verifyOtp({
          userId: loginRes.userId,
          otp: '123456',
        });
        expect(verifyOtpRes).toHaveProperty('accessToken');
        expect(verifyOtpRes).toHaveProperty('user');
      } else {
        expect(loginRes).toHaveProperty('token');
      }
    });

    it('Step 5: Should retrieve current authenticated user via /auth/me', async () => {
      const me = await authController.getProfile(adminPayload.userId);
      expect(me.user.email).toBe(adminUser.email);
      expect(me.user.role).toBe('Super Admin');
    });

    it('Step 6: Should handle password setup, forgot password, and change password', async () => {
      const forgotRes = await authController.forgotPassword({ email: 'jane@safevitals.com' });
      expect(forgotRes.success).toBe(true);

      const user = usersStore.get(registeredUserId);
      user.activationToken = 'test-reset-token';
      user.activationTokenExpiresAt = new Date(Date.now() + 86400000);

      const setupRes = await authController.setupPassword({
        token: 'test-reset-token',
        password: 'BrandNewSecurePassword123!',
      });
      expect(setupRes.success).toBe(true);

      const changeRes = await authController.changePassword(
        adminPayload.userId,
        {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewAdminPassword456!',
        },
      );
      expect(changeRes.success).toBe(true);
    });

    it('Step 7: Should handle logout', async () => {
      const logoutRes = await authController.logout();
      expect(logoutRes.success).toBe(true);
    });
  });

  describe('TASK 5: Core Workforce & CRM Entities Management', () => {
    let departmentId: string;
    let teamId: string;
    let positionId: string;
    let employeeId: string;

    it('Step 8: Organization Settings - Retrieve and Update', async () => {
      const settings = await orgSettingsController.getSettings();
      expect(settings).toBeDefined();

      const updated = await orgSettingsController.updateSettings({
        companyName: 'SafeVitals XR Labs',
        contactEmail: 'contact@safevitals.com',
        currency: 'USD',
      });
      expect(updated.companyName).toBe('SafeVitals XR Labs');
      expect(updated.contactEmail).toBe('contact@safevitals.com');
    });

    it('Step 9: Departments - Create, List, and Archive via PATCH', async () => {
      const dept = await departmentsController.create({
        name: 'Spatial Computing',
        description: 'Vision Pro & XR Engineering',
      });
      expect(dept).toBeDefined();
      departmentId = dept._id.toString();

      const list = await departmentsController.findAll();
      expect(list.some((d) => d._id.toString() === departmentId)).toBe(true);

      const archived = await departmentsController.archive(departmentId);
      expect(archived.isArchived).toBe(true);
    });

    it('Step 10: Positions - Create, List, Update (PUT), and Archive (PATCH)', async () => {
      const pos = await positionsController.create({
        name: 'XR Spatial Engineer',
        departmentId,
        level: 'Senior',
        description: 'Immersive user experience engineer',
      });
      expect(pos).toBeDefined();
      positionId = pos._id.toString();

      const list = await positionsController.findAll();
      expect(list.some((p) => p._id.toString() === positionId)).toBe(true);

      const updated = await positionsController.update(positionId, {
        name: 'Senior XR Spatial Engineer',
        level: 'Lead',
      });
      expect(updated.name).toBe('Senior XR Spatial Engineer');

      const archived = await positionsController.archive(positionId);
      expect(archived.isArchived).toBe(true);
    });

    it('Step 11: Teams - Create, List, and Archive via PATCH', async () => {
      const team = await teamsController.create({
        name: 'Optics & Display Squad',
        departmentId,
      });
      expect(team).toBeDefined();
      teamId = team._id.toString();

      const list = await teamsController.findAll();
      expect(list.some((t) => t._id.toString() === teamId)).toBe(true);

      const archived = await teamsController.archive(teamId);
      expect(archived.isArchived).toBe(true);
    });

    it('Step 12: Employees - Create, Update, Suspend, Reactivate, and Deactivate', async () => {
      const roles = await rolesController.findAll();
      const emp = await employeesController.create(
        {
          name: 'Alex Mercer',
          firstName: 'Alex',
          lastName: 'Mercer',
          email: 'alex@safevitals.com',
          departmentId,
          positionId,
          teamId,
          roleId: roles[0]._id.toString(),
          joiningDate: '2026-01-15',
        },
        adminPayload,
      );
      expect(emp).toBeDefined();
      employeeId = emp._id.toString();

      // Update employee
      const updated = await employeesController.update(
        employeeId,
        { name: 'Alexander Mercer' },
        adminPayload,
      );
      expect(updated.name).toBe('Alexander Mercer');

      // Suspend
      const suspendRes = await employeesController.suspend(employeeId, adminPayload);
      expect(suspendRes.success).toBe(true);

      // Reactivate
      const reactivateRes = await employeesController.reactivate(employeeId, adminPayload);
      expect(reactivateRes.success).toBe(true);

      // Deactivate
      const deactivateRes = await employeesController.deactivate(employeeId, adminPayload);
      expect(deactivateRes.success).toBe(true);
    });

    it('Step 13: Attendance - Check-in with location, Break-start, Break-end, Check-out', async () => {
      const emp = employeesStore.get(employeeId);
      emp.status = 'ACTIVE';
      emp.userId = adminUser._id;
      adminPayload.employeeDocId = employeeId;

      // Dual route support: check-in with employeeId param and location
      const checkInRes = await attendanceController.checkIn(
        adminPayload,
        { location: { address: 'Spatial Lab HQ, SF' } },
        employeeId,
      );
      expect(checkInRes.status?.toLowerCase()).toBe('present');
      expect(checkInRes.checkInAt).toBeDefined();

      // Break Start
      const breakStartRes = await attendanceController.startBreak(adminPayload, employeeId);
      expect(breakStartRes.status).toBeDefined();

      // Break End
      const breakEndRes = await attendanceController.endBreak(adminPayload, employeeId);
      expect(breakEndRes.status).toBeDefined();

      // Check Out
      const checkOutRes = await attendanceController.checkOut(
        adminPayload,
        { location: { address: 'Spatial Lab HQ, SF' } },
        employeeId,
      );
      expect(checkOutRes.status).toBeDefined();
      expect(checkOutRes.checkOutAt).toBeDefined();
    });

    it('Step 14: Leave Requests - Submit with auto-calculated days & Review via PATCH', async () => {
      const leave = await leaveController.create(
        adminPayload,
        {
          leaveType: 'Casual',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
          reason: 'Spatial conference participation',
        },
      );
      expect(leave).toBeDefined();
      expect(leave.days).toBeGreaterThanOrEqual(1);
      expect(leave.status?.toLowerCase()).toBe('pending');

      const reviewed = await leaveController.review(
        leave._id.toString(),
        adminPayload.userId,
        { status: 'Approved', note: 'Approved for conference' },
      );
      expect(reviewed.status?.toLowerCase()).toBe('approved');
    });

    it('Step 15: Schedules - Create Shift Templates & List', async () => {
      const schedule = await schedulesController.create({
        name: 'Standard Spatial Morning Shift',
        startTime: '09:00',
        endTime: '17:00',
        workDays: ['Monday', 'Tuesday', 'Wednesday'],
      });
      expect(schedule).toBeDefined();
      expect(schedule.name).toBe('Standard Spatial Morning Shift');

      const allSchedules = await schedulesController.findAll({});
      expect(allSchedules.length).toBeGreaterThan(0);
    });

    it('Step 16: Tasks - Create with assignedTo, update status with Title Case, and delete', async () => {
      const task = await tasksController.create(
        adminPayload.userId,
        {
          title: 'Implement Hand Tracking Pipeline',
          description: 'Calibrate optical sensor feed for latency reduction',
          assignedTo: employeeId,
          dueDate: '2026-11-15',
          priority: 'High',
        },
      );
      expect(task).toBeDefined();
      expect(task.title).toBe('Implement Hand Tracking Pipeline');

      const updated = await tasksController.updateStatus(task._id.toString(), {
        status: 'In Progress',
      });
      expect(updated.status).toBe('In Progress');

      const del = await tasksController.delete(task._id.toString());
      expect(del).toBeDefined();
    });

    it('Step 17: Tickets - Create with title alias and resolve via PATCH', async () => {
      const ticket = await ticketsController.create(
        adminPayload.userId,
        {
          title: 'XR Headset Display Flickering',
          description: 'Left eye panel shows horizontal scan lines at 90Hz',
          category: 'XR Hardware',
          priority: 'High',
        },
      );
      expect(ticket).toBeDefined();

      const resolved = await ticketsController.resolve(ticket._id.toString());
      expect(resolved.status?.toLowerCase()).toBe('resolved');
    });

    it('Step 18: Weekly Reports - Create with weekly fields and review via PATCH', async () => {
      const report = await reportsController.create(
        adminPayload.userId,
        {
          weekStartDate: '2026-10-05',
          weekEndDate: '2026-10-11',
          workedOn: 'Integrated spatial gesture recognition module',
          completed: 'Closed sprint milestones 1 through 3',
          blockers: 'None',
          nextWeekPlan: 'Conduct hardware latency benchmarks',
        },
      );
      expect(report).toBeDefined();

      const reviewed = await reportsController.reviewPatch(
        report._id.toString(),
        adminPayload.userId,
        { status: 'Approved', reviewMessage: 'Excellent progress' },
      );
      expect(reviewed.status).toBe('Approved');
    });

    it('Step 19: Access Requests - Submit and review via PATCH', async () => {
      const req = await accessRequestsController.create(
        adminPayload,
        {
          requestedSystem: 'Spatial Cloud SDK Gateway',
          reason: 'Need production access for testing tracking SDK',
        },
      );
      expect(req).toBeDefined();

      const reviewRes = await accessRequestsController.review(
        req._id.toString(),
        adminPayload,
        { status: 'Approved', note: 'Production access provisioned' },
      );
      expect(reviewRes.success).toBe(true);
    });

    it('Step 20: Notifications - List and Mark Read / Mark All Read', async () => {
      await notificationsService.createNotification(
        adminUser._id.toString(),
        'System Alert',
        'Spatial server synchronized',
      );

      const notifications = await notificationsController.findForUser(adminPayload.userId);
      expect(notifications.length).toBeGreaterThan(0);

      const notifId = notifications[0]._id.toString();
      const markOne = await notificationsController.markAsRead(notifId, adminPayload.userId);
      expect(markOne.isRead).toBe(true);

      const markAll = await notificationsController.markAllAsRead(adminPayload.userId);
      expect(markAll.message).toBeDefined();
    });

    it('Step 21: Audit Logs - Retrieval', async () => {
      const logs = await auditController.findAll({});
      expect(Array.isArray(logs)).toBe(true);
    });
  });
});
