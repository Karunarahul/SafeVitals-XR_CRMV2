import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { Permission, PermissionDocument } from '../permissions/schemas/permission.schema';
import { Department, DepartmentDocument } from '../departments/schemas/department.schema';
import { Position, PositionDocument } from '../positions/schemas/position.schema';
import { OrgSettings, OrgSettingsDocument } from '../org-settings/schemas/org-settings.schema';
import { SequenceService } from './sequence.service';

@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name) private readonly permModel: Model<PermissionDocument>,
    @InjectModel(Department.name) private readonly deptModel: Model<DepartmentDocument>,
    @InjectModel(Position.name) private readonly posModel: Model<PositionDocument>,
    @InjectModel(OrgSettings.name) private readonly orgSettingsModel: Model<OrgSettingsDocument>,
    private readonly sequenceService: SequenceService,
    private readonly configService: ConfigService,
  ) {}

  async seedAll() {
    this.logger.log('Executing idempotent database bootstrap...');
    await this.seedPermissions();
    await this.seedRoles();
    await this.seedDepartmentsAndPositions();
    await this.seedOrgSettings();
    await this.seedInitialAdmin();
  }

  async seedPermissions() {
    const defaultPermissions = [
      { code: 'users.read', name: 'View Users', module: 'Users' },
      { code: 'users.write', name: 'Manage Users', module: 'Users' },
      { code: 'users.approve', name: 'Approve Users', module: 'Users' },
      { code: 'employees.read', name: 'View Employees', module: 'Employees' },
      { code: 'employees.write', name: 'Manage Employees', module: 'Employees' },
      { code: 'employees.delete', name: 'Delete Employees', module: 'Employees' },
      { code: 'departments.read', name: 'View Departments', module: 'Organization' },
      { code: 'departments.write', name: 'Manage Departments', module: 'Organization' },
      { code: 'teams.read', name: 'View Teams', module: 'Organization' },
      { code: 'teams.write', name: 'Manage Teams', module: 'Organization' },
      { code: 'positions.read', name: 'View Positions', module: 'Organization' },
      { code: 'positions.write', name: 'Manage Positions', module: 'Organization' },
      { code: 'roles.read', name: 'View Roles', module: 'Roles' },
      { code: 'roles.write', name: 'Manage Roles', module: 'Roles' },
      { code: 'attendance.read', name: 'View Attendance', module: 'Attendance' },
      { code: 'attendance.write', name: 'Manage Attendance', module: 'Attendance' },
      { code: 'leave.read', name: 'View Leave', module: 'Leave' },
      { code: 'leave.write', name: 'Request Leave', module: 'Leave' },
      { code: 'leave.approve', name: 'Approve Leave', module: 'Leave' },
      { code: 'schedules.read', name: 'View Schedules', module: 'Schedules' },
      { code: 'schedules.write', name: 'Manage Schedules', module: 'Schedules' },
      { code: 'tasks.read', name: 'View Tasks', module: 'Tasks' },
      { code: 'tasks.write', name: 'Manage Tasks', module: 'Tasks' },
      { code: 'tickets.read', name: 'View Tickets', module: 'Tickets' },
      { code: 'tickets.write', name: 'Manage Tickets', module: 'Tickets' },
      { code: 'reports.read', name: 'View Reports', module: 'Reports' },
      { code: 'reports.write', name: 'Submit Reports', module: 'Reports' },
      { code: 'access.read', name: 'View Access Requests', module: 'Access' },
      { code: 'access.approve', name: 'Approve Access Requests', module: 'Access' },
      { code: 'audit.read', name: 'View Audit Logs', module: 'Audit' },
      { code: 'settings.read', name: 'View Settings', module: 'Settings' },
      { code: 'settings.write', name: 'Manage Settings', module: 'Settings' },
    ];

    for (const p of defaultPermissions) {
      await this.permModel.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
    }
  }

  async seedRoles() {
    const allPerms = (await this.permModel.find().lean()).map((p) => p.code);

    const defaultRoles = [
      {
        name: 'Super Admin',
        description: 'Complete system access with unrestricted administrative privileges',
        permissions: allPerms,
        isSystem: true,
        status: 'Active',
      },
      {
        name: 'Manager',
        description: 'Departmental leadership with employee oversight and approval authority',
        permissions: [
          'employees.read',
          'departments.read',
          'teams.read',
          'teams.write',
          'positions.read',
          'attendance.read',
          'attendance.write',
          'leave.read',
          'leave.approve',
          'schedules.read',
          'schedules.write',
          'tasks.read',
          'tasks.write',
          'tickets.read',
          'tickets.write',
          'reports.read',
          'reports.write',
          'access.read',
        ],
        isSystem: true,
        status: 'Active',
      },
      {
        name: 'Employee',
        description: 'Standard staff member with self-service capabilities',
        permissions: [
          'employees.read',
          'attendance.read',
          'attendance.write',
          'leave.read',
          'leave.write',
          'schedules.read',
          'tasks.read',
          'tasks.write',
          'tickets.read',
          'tickets.write',
          'reports.read',
          'reports.write',
        ],
        isSystem: true,
        status: 'Active',
      },
    ];

    for (const r of defaultRoles) {
      await this.roleModel.updateOne({ name: r.name }, { $setOnInsert: r }, { upsert: true });
    }
  }

  async seedDepartmentsAndPositions() {
    const existingDepts = await this.deptModel.countDocuments();
    if (existingDepts === 0) {
      const engineering = await this.deptModel.create({
        name: 'Engineering',
        code: 'ENG',
        description: 'Software and Spatial Hardware R&D',
        color: '#3B82F6',
      });
      const hr = await this.deptModel.create({
        name: 'Human Resources',
        code: 'HR',
        description: 'People Operations and Talent Acquisition',
        color: '#EC4899',
      });
      const ops = await this.deptModel.create({
        name: 'Operations',
        code: 'OPS',
        description: 'XR Clinical Hardware Logistics',
        color: '#10B981',
      });

      await this.posModel.create([
        {
          title: 'Senior Software Engineer',
          name: 'Senior Software Engineer',
          departmentId: engineering._id,
          level: 'Senior',
          description: 'Fullstack spatial CRM engineer',
        },
        {
          title: 'Frontend Developer',
          name: 'Frontend Developer',
          departmentId: engineering._id,
          level: 'Mid-Level',
          description: 'Next.js & React specialist',
        },
        {
          title: 'HR Manager',
          name: 'HR Manager',
          departmentId: hr._id,
          level: 'Lead',
          description: 'Talent management and compliance',
        },
        {
          title: 'Operations Lead',
          name: 'Operations Lead',
          departmentId: ops._id,
          level: 'Lead',
          description: 'Logistics and device QA lead',
        },
      ]);
    }
  }

  async seedOrgSettings() {
    const existing = await this.orgSettingsModel.countDocuments();
    if (existing === 0) {
      await this.orgSettingsModel.create({
        companyName: 'SafeVitals XR',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      });
    }
  }

  /**
   * Idempotent administrator seed command.
   * If an administrator with SEED_ADMIN_EMAIL already exists,
   * it will NEVER overwrite or reset the existing administrator's password.
   */
  async seedInitialAdmin(): Promise<{ created: boolean; email: string }> {
    const adminEmail = (
      this.configService.get<string>('seed.adminEmail') ||
      process.env.SEED_ADMIN_EMAIL ||
      'admin@safevitals.com'
    ).toLowerCase();

    let adminPassword =
      this.configService.get<string>('seed.adminPassword') ||
      process.env.SEED_ADMIN_PASSWORD;

    const isProduction =
      this.configService.get<string>('nodeEnv') === 'production' ||
      process.env.NODE_ENV === 'production';

    // Password security enforcement:
    // If no password is provided in production, throw an error to prevent insecure deployment.
    if (isProduction && !adminPassword) {
      throw new Error(
        '[SECURITY] In production environments, SEED_ADMIN_PASSWORD environment variable must be explicitly defined and cannot use default fallback.',
      );
    }

    // If no password provided in non-production, generate a secure random password or fallback
    let mustChangePassword = false;
    if (!adminPassword) {
      adminPassword = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, 'A') + '!1Aa';
      mustChangePassword = true;
      this.logger.warn(
        `[SECURITY] SEED_ADMIN_PASSWORD was not specified. Generated secure bootstrap password: ${adminPassword}`,
      );
    } else {
      // Validate password complexity
      const hasLength = adminPassword.length >= 8;
      const hasUpper = /[A-Z]/.test(adminPassword);
      const hasLower = /[a-z]/.test(adminPassword);
      const hasDigit = /[0-9]/.test(adminPassword);
      if (!hasLength || !hasUpper || !hasLower || !hasDigit) {
        if (isProduction) {
          throw new Error(
            '[SECURITY] SEED_ADMIN_PASSWORD does not meet enterprise security requirements (min 8 chars, uppercase, lowercase, digit).',
          );
        } else {
          mustChangePassword = true;
        }
      }
    }

    const adminName =
      this.configService.get<string>('seed.adminName') ||
      process.env.SEED_ADMIN_NAME ||
      'System Administrator';

    const existingAdmin = await this.userModel.findOne({ email: adminEmail });
    if (existingAdmin) {
      this.logger.log(
        `[IDEMPOTENT] Administrator '${adminEmail}' already exists. Password was NOT overwritten.`,
      );
      return { created: false, email: adminEmail };
    }

    const superAdminRole = await this.roleModel.findOne({ name: 'Super Admin' });
    const engDept = await this.deptModel.findOne({ name: 'Engineering' });
    const pos = await this.posModel.findOne({ title: 'Senior Software Engineer' });

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const empId = await this.sequenceService.getNextSequence('employeeId', 'EMP-', 6);

    // Create User
    const user = await this.userModel.create({
      email: adminEmail,
      password: hashedPassword,
      passwordHash: hashedPassword,
      name: adminName,
      firstName: adminName.split(' ')[0],
      lastName: adminName.split(' ').slice(1).join(' ') || 'Admin',
      role: 'Super Admin',
      roleId: superAdminRole?._id,
      departmentId: engDept?._id,
      positionId: pos?._id,
      status: UserStatus.ACTIVE,
      isSuperAdmin: true,
      isEmailVerified: true,
      mustChangePassword,
    });


    // Create Employee
    const employee = await this.employeeModel.create({
      employeeId: empId,
      name: adminName,
      firstName: adminName.split(' ')[0],
      lastName: adminName.split(' ').slice(1).join(' ') || 'Admin',
      email: adminEmail,
      userId: user._id,
      departmentId: engDept?._id,
      positionId: pos?._id,
      roleId: superAdminRole?._id,
      role: 'Super Admin',
      status: 'Active',
      joiningDate: new Date().toISOString().split('T')[0],
    });

    user.employeeDocId = employee._id;
    await user.save();

    this.logger.log(`[SUCCESS] Initial Super Admin created: ${adminEmail} (EMP ID: ${empId})`);
    return { created: true, email: adminEmail };
  }
}
