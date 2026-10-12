import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserStatus } from './schemas/user.schema';
import { EmployeesController } from '../employees/employees.controller';
import { EmployeesService } from '../employees/employees.service';
import { Employee } from '../employees/schemas/employee.schema';
import { Invitation } from '../employees/schemas/invitation.schema';
import { AccessRequestsController } from '../access-requests/access-requests.controller';
import { AccessRequestsService } from '../access-requests/access-requests.service';
import { AccessRequest } from '../access-requests/schemas/access-request.schema';
import { Role } from '../roles/schemas/role.schema';
import { AuditService } from '../audit/audit.service';
import { SequenceService } from '../database/sequence.service';
import { ReferenceValidatorService } from '../database/reference-validator.service';
import { MailService } from '../mail/mail.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('Authorization & Account Administration (Integration)', () => {
  let usersService: UsersService;
  let usersController: UsersController;
  let employeesService: EmployeesService;
  let employeesController: EmployeesController;
  let accessRequestsService: AccessRequestsService;
  let accessRequestsController: AccessRequestsController;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  // In-memory data store
  const usersStore = new Map<string, any>();
  const employeesStore = new Map<string, any>();
  const accessRequestsStore = new Map<string, any>();
  const rolesStore = new Map<string, any>();
  const auditLogsStore: any[] = [];

  const createMockQuery = (result: any) => {
    const query: any = {
      populate: jest.fn().mockImplementation(() => query),
      select: jest.fn().mockImplementation(() => query),
      sort: jest.fn().mockImplementation(() => query),
      limit: jest.fn().mockImplementation(() => query),
      lean: jest.fn().mockImplementation(() => Promise.resolve(result)),
      then: (resolve: any) => resolve(result),
    };
    return query;
  };

  const mockUserModel = {
    find: jest.fn().mockImplementation((filter?: any) => {
      const all = Array.from(usersStore.values());
      if (filter && filter.status) {
        return createMockQuery(all.filter((u) => u.status === filter.status));
      }
      return createMockQuery(all);
    }),
    findById: jest.fn().mockImplementation((id: string) => {
      const user = usersStore.get(id.toString());
      if (!user) return createMockQuery(null);
      const doc = {
        ...user,
        save: jest.fn().mockImplementation(async function () {
          usersStore.set(id.toString(), this);
          return this;
        }),
      };
      return createMockQuery(doc);
    }),
    findOne: jest.fn().mockImplementation((filter: any) => {
      for (const u of usersStore.values()) {
        if (filter.email && u.email === filter.email.toLowerCase()) return createMockQuery(u);
        if (filter.firebaseUid && u.firebaseUid === filter.firebaseUid) return createMockQuery(u);
      }
      return createMockQuery(null);
    }),
    create: jest.fn().mockImplementation(async (data: any) => {
      const id = data._id || new Types.ObjectId().toString();
      const doc = {
        _id: new Types.ObjectId(id),
        id,
        ...data,
        save: jest.fn().mockImplementation(async function () {
          usersStore.set(id, this);
          return this;
        }),
      };
      usersStore.set(id, doc);
      return doc;
    }),
    findByIdAndUpdate: jest.fn().mockImplementation((id: string, update: any) => {
      const user = usersStore.get(id.toString());
      if (!user) return createMockQuery(null);
      const changes = update.$set || update;
      Object.assign(user, changes);
      return createMockQuery(user);
    }),
  };

  const mockEmployeeModel = {
    find: jest.fn().mockImplementation(() => createMockQuery(Array.from(employeesStore.values()))),
    findById: jest.fn().mockImplementation((id: string) => {
      const emp = employeesStore.get(id.toString());
      if (!emp) return createMockQuery(null);
      return createMockQuery({
        ...emp,
        save: jest.fn().mockImplementation(async function () {
          employeesStore.set(id.toString(), this);
          return this;
        }),
      });
    }),
    findOne: jest.fn().mockImplementation((filter: any) => {
      for (const emp of employeesStore.values()) {
        if (filter.email && emp.email === filter.email.toLowerCase()) return createMockQuery(emp);
        if (filter.employeeId && emp.employeeId === filter.employeeId) return createMockQuery(emp);
        if (filter.userId && emp.userId?.toString() === filter.userId?.toString()) return createMockQuery(emp);
        if (filter.$or) {
          for (const cond of filter.$or) {
            if (cond.employeeId && emp.employeeId === cond.employeeId) return createMockQuery(emp);
            if (cond.email && emp.email === cond.email.toLowerCase()) return createMockQuery(emp);
            if (cond.userId && emp.userId?.toString() === cond.userId?.toString()) return createMockQuery(emp);
          }
        }
      }
      return createMockQuery(null);
    }),
    create: jest.fn().mockImplementation(async (data: any) => {
      const id = data._id || new Types.ObjectId().toString();
      const doc = {
        _id: new Types.ObjectId(id),
        id,
        ...data,
        save: jest.fn().mockImplementation(async function () {
          employeesStore.set(id, this);
          return this;
        }),
      };
      employeesStore.set(id, doc);
      return doc;
    }),
    findByIdAndUpdate: jest.fn().mockImplementation((id: string, update: any) => {
      const emp = employeesStore.get(id.toString());
      if (!emp) return createMockQuery(null);
      const changes = update.$set || update;
      Object.assign(emp, changes);
      return createMockQuery(emp);
    }),
    findByIdAndDelete: jest.fn().mockImplementation(async (id: string) => {

      employeesStore.delete(id.toString());
      return true;
    }),
  };

  const mockAccessRequestModel = {
    find: jest.fn().mockImplementation(() => createMockQuery(Array.from(accessRequestsStore.values()))),
    findById: jest.fn().mockImplementation((id: string) => {
      const req = accessRequestsStore.get(id.toString());
      if (!req) return null;
      return {
        ...req,
        save: jest.fn().mockImplementation(async function () {
          accessRequestsStore.set(id.toString(), this);
          return this;
        }),
      };
    }),
    create: jest.fn().mockImplementation(async (data: any) => {
      const id = data._id || new Types.ObjectId().toString();
      const doc = {
        _id: new Types.ObjectId(id),
        id,
        ...data,
        save: jest.fn().mockImplementation(async function () {
          accessRequestsStore.set(id, this);
          return this;
        }),
      };
      accessRequestsStore.set(id, doc);
      return doc;
    }),
  };

  const mockRoleModel = {
    findById: jest.fn().mockImplementation((id: string) => {
      const role = rolesStore.get(id.toString());
      return createMockQuery(role || null);
    }),
    findOne: jest.fn().mockImplementation((filter: any) => {
      for (const r of rolesStore.values()) {
        if (filter.name && r.name === filter.name) return createMockQuery(r);
      }
      return createMockQuery(null);
    }),
  };

  const mockInvitationModel = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockAuditService = {
    log: jest.fn().mockImplementation(async (user: any, dto: any, ip?: string) => {
      const entry = { user, ...dto, ip, createdAt: new Date() };
      auditLogsStore.push(entry);
      return entry;
    }),
    findAll: jest.fn().mockImplementation(async () => auditLogsStore),
  };

  const mockSequenceService = {
    getNextSequence: jest.fn().mockResolvedValue('EMP-000100'),
  };

  const mockValidatorService = {
    validateDepartment: jest.fn().mockImplementation(async (id: string) => new Types.ObjectId(id)),
    validateTeam: jest.fn().mockImplementation(async (id: string) => new Types.ObjectId(id)),
    validatePosition: jest.fn().mockImplementation(async (id: string) => new Types.ObjectId(id)),
    validateRole: jest.fn().mockImplementation(async (id: string) => {
      const role = rolesStore.get(id.toString());
      if (role) return { id: new Types.ObjectId(id), name: role.name };
      return null;
    }),
  };

  const mockMailService = {
    sendInvitationEmail: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    // Seed default roles in store
    const superAdminRoleId = new Types.ObjectId().toString();
    const managerRoleId = new Types.ObjectId().toString();
    const employeeRoleId = new Types.ObjectId().toString();

    rolesStore.set(superAdminRoleId, {
      _id: new Types.ObjectId(superAdminRoleId),
      id: superAdminRoleId,
      name: 'Super Admin',
      permissions: ['*.*.*'],
    });

    rolesStore.set(managerRoleId, {
      _id: new Types.ObjectId(managerRoleId),
      id: managerRoleId,
      name: 'Manager',
      permissions: ['employees.view', 'employees.create', 'employees.edit', 'access.review'],
    });

    rolesStore.set(employeeRoleId, {
      _id: new Types.ObjectId(employeeRoleId),
      id: employeeRoleId,
      name: 'Employee',
      permissions: ['employees.view', 'access.request'],
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController, EmployeesController, AccessRequestsController],
      providers: [
        UsersService,
        EmployeesService,
        AccessRequestsService,
        RolesGuard,
        Reflector,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Employee.name), useValue: mockEmployeeModel },
        { provide: getModelToken(AccessRequest.name), useValue: mockAccessRequestModel },
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
        { provide: getModelToken(Invitation.name), useValue: mockInvitationModel },
        { provide: AuditService, useValue: mockAuditService },
        { provide: SequenceService, useValue: mockSequenceService },
        { provide: ReferenceValidatorService, useValue: mockValidatorService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    usersController = module.get<UsersController>(UsersController);
    employeesService = module.get<EmployeesService>(EmployeesService);
    employeesController = module.get<EmployeesController>(EmployeesController);
    accessRequestsService = module.get<AccessRequestsService>(AccessRequestsService);
    accessRequestsController = module.get<AccessRequestsController>(AccessRequestsController);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  beforeEach(() => {
    usersStore.clear();
    employeesStore.clear();
    accessRequestsStore.clear();
    auditLogsStore.length = 0;
    jest.clearAllMocks();
  });

  describe('1. Role & Permission Guard Evaluation (RBAC / Wildcards)', () => {
    const createMockExecutionContext = (user: CurrentUserPayload): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;
    };

    it('should grant access to Super Admin with wildcard permission (*.*.*)', () => {
      const superAdminUser: CurrentUserPayload = {
        userId: 'admin_1',
        email: 'admin@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
        permissions: ['*.*.*'],
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === ROLES_KEY) return ['Super Admin'];
        if (key === PERMISSIONS_KEY) return ['employees.suspend'];
        return undefined;
      });

      const context = createMockExecutionContext(superAdminUser);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should grant access when user has the specific required permission', () => {
      const managerUser: CurrentUserPayload = {
        userId: 'mgr_1',
        email: 'manager@safevitals.com',
        role: 'Manager',
        permissions: ['employees.create', 'employees.view'],
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === PERMISSIONS_KEY) return ['employees.create'];
        return undefined;
      });

      const context = createMockExecutionContext(managerUser);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should grant access when user matches permission via module wildcard (e.g. employees.*)', () => {
      const powerUser: CurrentUserPayload = {
        userId: 'lead_1',
        email: 'lead@safevitals.com',
        role: 'Lead',
        permissions: ['employees.*'],
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === PERMISSIONS_KEY) return ['employees.suspend'];
        return undefined;
      });

      const context = createMockExecutionContext(powerUser);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should reject unauthorized access with 403 Forbidden when user lacks permissions and roles', () => {
      const employeeUser: CurrentUserPayload = {
        userId: 'emp_1',
        email: 'emp@safevitals.com',
        role: 'Employee',
        permissions: ['employees.view'],
      };

      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === ROLES_KEY) return ['Super Admin'];
        if (key === PERMISSIONS_KEY) return ['employees.suspend'];
        return undefined;
      });

      const context = createMockExecutionContext(employeeUser);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('2. User Listing & Pending Candidates', () => {
    it('should list all registered users and filter pending candidates', async () => {
      const pendingUserId = new Types.ObjectId().toString();
      const activeUserId = new Types.ObjectId().toString();

      usersStore.set(pendingUserId, {
        _id: new Types.ObjectId(pendingUserId),
        name: 'Pending Jane',
        email: 'jane@example.com',
        status: UserStatus.PENDING,
      });

      usersStore.set(activeUserId, {
        _id: new Types.ObjectId(activeUserId),
        name: 'Active Bob',
        email: 'bob@example.com',
        status: UserStatus.ACTIVE,
      });

      const allUsers = await usersController.findAll();
      expect(allUsers.length).toBe(2);

      const pendingUsers = await usersController.findPending();
      expect(pendingUsers.length).toBe(1);
      expect(pendingUsers[0].name).toBe('Pending Jane');
    });
  });

  describe('3. User Approval Workflow & Self-Approval Prevention', () => {
    it('should approve candidate, create employee, and log audit event', async () => {
      const candidateId = new Types.ObjectId().toString();
      const adminId = new Types.ObjectId().toString();
      const deptId = new Types.ObjectId().toString();

      usersStore.set(candidateId, {
        _id: new Types.ObjectId(candidateId),
        name: 'Jane Candidate',
        email: 'jane.candidate@safevitals.com',
        status: UserStatus.PENDING,
      });

      const adminUser: CurrentUserPayload = {
        userId: adminId,
        email: 'admin@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
      };

      const result = await usersController.approveCandidate(
        candidateId,
        {
          departmentId: deptId,
        },
        adminUser,
      );

      expect(result.success).toBe(true);
      expect(result.user.status).toBe(UserStatus.ACTIVE);
      expect(result.employee).toBeDefined();
      expect(result.employee.employeeId).toBe('EMP-000100');

      // Verify audit log recorded
      const log = auditLogsStore.find((l) => l.action === 'USER_APPROVED');
      expect(log).toBeDefined();
      expect(log.targetId).toBe(candidateId);
      expect(log.user.userId).toBe(adminId);
    });

    it('should prevent administrators from approving their own account (Self-Approval Prevention)', async () => {
      const adminId = new Types.ObjectId().toString();

      usersStore.set(adminId, {
        _id: new Types.ObjectId(adminId),
        name: 'Self Approver',
        email: 'self@safevitals.com',
        status: UserStatus.PENDING,
      });

      const adminUser: CurrentUserPayload = {
        userId: adminId,
        email: 'self@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
      };

      await expect(
        usersController.approveCandidate(adminId, {}, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-super administrators attempting to assign Super Admin role during approval', async () => {
      const candidateId = new Types.ObjectId().toString();
      const managerId = new Types.ObjectId().toString();
      const superAdminRoleEntry = Array.from(rolesStore.values()).find((r) => r.name === 'Super Admin');

      usersStore.set(candidateId, {
        _id: new Types.ObjectId(candidateId),
        name: 'Elevated Candidate',
        email: 'elevate@safevitals.com',
        status: UserStatus.PENDING,
      });

      const managerUser: CurrentUserPayload = {
        userId: managerId,
        email: 'manager@safevitals.com',
        role: 'Manager',
        isSuperAdmin: false,
      };

      await expect(
        usersController.approveCandidate(
          candidateId,
          { roleId: superAdminRoleEntry.id },
          managerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Candidate Rejection', () => {
    it('should reject pending candidate registration and log audit event', async () => {
      const candidateId = new Types.ObjectId().toString();
      const adminId = new Types.ObjectId().toString();

      usersStore.set(candidateId, {
        _id: new Types.ObjectId(candidateId),
        name: 'Rejected Candidate',
        email: 'rejected@example.com',
        status: UserStatus.PENDING,
      });

      const adminUser: CurrentUserPayload = {
        userId: adminId,
        email: 'admin@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
      };

      const res = await usersController.rejectCandidate(
        candidateId,
        { reason: 'Background check incomplete' },
        adminUser,
      );

      expect(res.success).toBe(true);
      const updatedUser = usersStore.get(candidateId);
      expect(updatedUser.status).toBe(UserStatus.DEACTIVATED);

      const log = auditLogsStore.find((l) => l.action === 'USER_REJECTED');
      expect(log).toBeDefined();
      expect(log.details.reason).toBe('Background check incomplete');
    });
  });

  describe('5. Employee Onboarding & Firebase UID Onboarding', () => {
    it('should onboard an employee via Firebase UID and link account', async () => {
      const adminUser: CurrentUserPayload = {
        userId: 'admin_1',
        email: 'admin@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
      };

      const result = await employeesController.onboardUid(
        {
          firebaseUid: 'firebase_uid_test_123',
          email: 'firebase.user@safevitals.com',
          name: 'Firebase Staff',
        },
        adminUser,
      );

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.firebaseUid).toBe('firebase_uid_test_123');
      expect(result.user.status).toBe(UserStatus.ACTIVE);
      expect(result.employee).toBeDefined();
      expect(result.employee.status).toBe('Active');

      const log = auditLogsStore.find((l) => l.action === 'EMPLOYEE_ONBOARDED_FIREBASE');
      expect(log).toBeDefined();
    });
  });

  describe('6. Account Suspension, Reactivation, and Deactivation', () => {
    it('should suspend, reactivate, and deactivate an employee account via PATCH endpoints', async () => {
      const empDocId = new Types.ObjectId().toString();
      const userDocId = new Types.ObjectId().toString();
      const adminId = new Types.ObjectId().toString();

      usersStore.set(userDocId, {
        _id: new Types.ObjectId(userDocId),
        name: 'Suspended Candidate',
        email: 'suspended@safevitals.com',
        status: UserStatus.ACTIVE,
      });

      employeesStore.set(empDocId, {
        _id: new Types.ObjectId(empDocId),
        employeeId: 'EMP-000050',
        name: 'Suspended Candidate',
        email: 'suspended@safevitals.com',
        userId: new Types.ObjectId(userDocId),
        status: 'Active',
      });

      const adminUser: CurrentUserPayload = {
        userId: adminId,
        email: 'admin@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
      };

      // 1. Suspend
      const suspendRes = await employeesController.suspend(empDocId, adminUser);
      expect(suspendRes.success).toBe(true);
      expect(employeesStore.get(empDocId).status).toBe('Suspended');
      expect(usersStore.get(userDocId).status).toBe(UserStatus.SUSPENDED);

      // 2. Reactivate
      const reactivateRes = await employeesController.reactivate(empDocId, adminUser);
      expect(reactivateRes.success).toBe(true);
      expect(employeesStore.get(empDocId).status).toBe('Active');
      expect(usersStore.get(userDocId).status).toBe(UserStatus.ACTIVE);

      // 3. Deactivate
      const deactivateRes = await employeesController.deactivate(empDocId, adminUser);
      expect(deactivateRes.success).toBe(true);
      expect(employeesStore.get(empDocId).status).toBe('Deactivated');
      expect(usersStore.get(userDocId).status).toBe(UserStatus.DEACTIVATED);

      // Verify audit trail recorded all transitions
      const actions = auditLogsStore.map((l) => l.action);
      expect(actions).toContain('EMPLOYEE_SUSPENDED');
      expect(actions).toContain('EMPLOYEE_REACTIVATED');
      expect(actions).toContain('EMPLOYEE_DEACTIVATED');
    });

    it('should prevent administrators from suspending or deactivating their own account', async () => {
      const adminUserId = new Types.ObjectId().toString();
      const adminEmpId = new Types.ObjectId().toString();

      usersStore.set(adminUserId, {
        _id: new Types.ObjectId(adminUserId),
        email: 'admin@safevitals.com',
        status: UserStatus.ACTIVE,
      });

      employeesStore.set(adminEmpId, {
        _id: new Types.ObjectId(adminEmpId),
        userId: new Types.ObjectId(adminUserId),
        email: 'admin@safevitals.com',
        status: 'Active',
      });

      const selfAdmin: CurrentUserPayload = {
        userId: adminUserId,
        employeeDocId: adminEmpId,
        email: 'admin@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
      };

      await expect(employeesController.suspend(adminEmpId, selfAdmin)).rejects.toThrow(
        BadRequestException,
      );

      await expect(employeesController.deactivate(adminEmpId, selfAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('7. Privilege Escalation Prevention', () => {
    it('should prevent employees from modifying their own security role', async () => {
      const userDocId = new Types.ObjectId().toString();
      const empDocId = new Types.ObjectId().toString();

      usersStore.set(userDocId, {
        _id: new Types.ObjectId(userDocId),
        role: 'Employee',
      });

      employeesStore.set(empDocId, {
        _id: new Types.ObjectId(empDocId),
        userId: new Types.ObjectId(userDocId),
        role: 'Employee',
      });

      const regularUser: CurrentUserPayload = {
        userId: userDocId,
        employeeDocId: empDocId,
        email: 'regular@safevitals.com',
        role: 'Employee',
      };

      await expect(
        employeesController.update(empDocId, { role: 'Super Admin' }, regularUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent non-super administrators from elevating anyone to Super Admin', async () => {
      const targetEmpId = new Types.ObjectId().toString();
      const managerId = new Types.ObjectId().toString();

      employeesStore.set(targetEmpId, {
        _id: new Types.ObjectId(targetEmpId),
        name: 'Target Employee',
        role: 'Employee',
      });

      const managerUser: CurrentUserPayload = {
        userId: managerId,
        email: 'manager@safevitals.com',
        role: 'Manager',
        isSuperAdmin: false,
      };

      await expect(
        employeesController.update(targetEmpId, { role: 'Super Admin' }, managerUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('8. Access Request Review Workflow', () => {
    it('should submit an access request and allow security admin to review it via PATCH', async () => {
      const requesterId = new Types.ObjectId().toString();
      const adminId = new Types.ObjectId().toString();

      const employeeUser: CurrentUserPayload = {
        userId: requesterId,
        email: 'dev@safevitals.com',
        role: 'Employee',
      };

      const adminUser: CurrentUserPayload = {
        userId: adminId,
        email: 'admin@safevitals.com',
        role: 'Super Admin',
        isSuperAdmin: true,
      };

      // 1. Submit request
      const req = await accessRequestsController.create(employeeUser, {
        requestedSystem: 'Kubernetes Cluster Access',
        reason: 'Deployment debugging',
      });

      expect(req).toBeDefined();
      expect(req.requestedSystem).toBe('Kubernetes Cluster Access');
      expect(req.status).toBe('Pending');

      // 2. Review request via PATCH
      const reviewRes = await accessRequestsController.review(req._id.toString(), adminUser, {
        status: 'Approved',
        note: 'Approved for 24h sprint',
      });

      expect(reviewRes.success).toBe(true);
      expect(reviewRes.data.status).toBe('Approved');
      expect(reviewRes.data.reviewNotes).toBe('Approved for 24h sprint');

      const actions = auditLogsStore.map((l) => l.action);
      expect(actions).toContain('ACCESS_REQUEST_SUBMITTED');
      expect(actions).toContain('ACCESS_REQUEST_APPROVED');
    });
  });
});
