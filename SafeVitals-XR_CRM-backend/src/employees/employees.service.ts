import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import { Employee, EmployeeDocument } from './schemas/employee.schema';
import { Invitation, InvitationDocument } from './schemas/invitation.schema';
import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import { SequenceService } from '../database/sequence.service';
import { ReferenceValidatorService } from '../database/reference-validator.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeDto, UpdateEmployeeDto, OnboardUidDto } from './dto/employees.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Invitation.name) private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly sequenceService: SequenceService,
    private readonly validatorService: ReferenceValidatorService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.departmentId && Types.ObjectId.isValid(query.departmentId)) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }
    if (query?.teamId && Types.ObjectId.isValid(query.teamId)) {
      filter.teamId = new Types.ObjectId(query.teamId);
    }
    if (query?.status) {
      filter.status = query.status;
    }
    if (query?.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ name: regex }, { email: regex }, { employeeId: regex }];
    }

    return this.employeeModel
      .find(filter)
      .populate('departmentId', 'name color code')
      .populate('teamId', 'name')
      .populate('positionId', 'title name')
      .populate('roleId', 'name')
      .lean();
  }

  async findByIdOrEmployeeId(idOrCode: string) {
    let employee: any = null;

    if (Types.ObjectId.isValid(idOrCode)) {
      employee = await this.employeeModel
        .findById(idOrCode)
        .populate('departmentId', 'name color code')
        .populate('teamId', 'name')
        .populate('positionId', 'title name')
        .populate('roleId', 'name')
        .lean();
    }

    if (!employee) {
      employee = await this.employeeModel
        .findOne({
          $or: [{ employeeId: idOrCode.toUpperCase() }, { email: idOrCode.toLowerCase() }],
        })
        .populate('departmentId', 'name color code')
        .populate('teamId', 'name')
        .populate('positionId', 'title name')
        .populate('roleId', 'name')
        .lean();
    }

    // Fallback: check if idOrCode matches a User's _id
    if (!employee && Types.ObjectId.isValid(idOrCode)) {
      employee = await this.employeeModel
        .findOne({ userId: new Types.ObjectId(idOrCode) })
        .populate('departmentId', 'name color code')
        .populate('teamId', 'name')
        .populate('positionId', 'title name')
        .populate('roleId', 'name')
        .lean();
    }

    if (!employee) {
      throw new NotFoundException(`Employee '${idOrCode}' not found`);
    }

    return employee;
  }

  async create(dto: CreateEmployeeDto, currentUser?: CurrentUserPayload) {
    const existing = await this.employeeModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (existing) {
      throw new ConflictException('An employee with this email already exists');
    }

    // Determine employee display name
    const name =
      dto.name ||
      `${dto.firstName || ''} ${dto.lastName || ''}`.trim() ||
      dto.email.split('@')[0];

    // Validate relationships
    let deptId: Types.ObjectId | null = null;
    let teamId: Types.ObjectId | null = null;
    let posId: Types.ObjectId | null = null;
    let roleId: Types.ObjectId | null = null;
    let roleName = dto.role || 'Employee';

    if (dto.departmentId) {
      deptId = await this.validatorService.validateDepartment(dto.departmentId);
    }
    if (dto.teamId) {
      teamId = await this.validatorService.validateTeam(dto.teamId, deptId || undefined);
    }
    if (dto.positionId) {
      posId = await this.validatorService.validatePosition(dto.positionId, deptId || undefined);
    }
    if (dto.roleId) {
      const validatedRole = await this.validatorService.validateRole(dto.roleId);
      if (validatedRole) {
        // Security check: Only Super Admin can assign Super Admin role
        if (
          validatedRole.name === 'Super Admin' &&
          currentUser &&
          !currentUser.isSuperAdmin &&
          currentUser.role !== 'Super Admin'
        ) {
          throw new ForbiddenException(
            'Only Super Administrators can assign the Super Admin role.',
          );
        }
        roleId = validatedRole.id;
        roleName = validatedRole.name;
      }
    }

    if (
      dto.role === 'Super Admin' &&
      currentUser &&
      !currentUser.isSuperAdmin &&
      currentUser.role !== 'Super Admin'
    ) {
      throw new ForbiddenException(
        'Only Super Administrators can assign the Super Admin role.',
      );
    }

    const employeeId = await this.sequenceService.getNextSequence(
      'employeeId',
      'EMP-',
      6,
    );

    // Create User record with activationToken
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const hashedActivationToken = crypto
      .createHash('sha256')
      .update(rawActivationToken)
      .digest('hex');
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (!user) {
      const userPayload: any = {
        email: dto.email.toLowerCase(),
        name,
        firstName: dto.firstName || name.split(' ')[0],
        lastName: dto.lastName || name.split(' ').slice(1).join(' ') || '',
        phone: dto.phone,
        role: roleName,
        roleId,
        departmentId: deptId,
        teamId,
        positionId: posId,
        status: UserStatus.PENDING,
        activationToken: hashedActivationToken,
        activationTokenExpiresAt: tokenExpiresAt,
      };

      if (dto.temporaryPassword) {
        const hashedTempPassword = await bcrypt.hash(dto.temporaryPassword, 10);
        userPayload.password = hashedTempPassword;
        userPayload.passwordHash = hashedTempPassword;
        userPayload.mustChangePassword = true;
      }

      user = await this.userModel.create(userPayload);
    }

    // Create Employee record
    const employee = await this.employeeModel.create({
      ...dto,
      name,
      firstName: dto.firstName || name.split(' ')[0],
      lastName: dto.lastName || name.split(' ').slice(1).join(' ') || '',
      employeeId,
      email: dto.email.toLowerCase(),
      userId: user._id,
      departmentId: deptId,
      teamId,
      positionId: posId,
      roleId,
      role: roleName,
      status: dto.status || 'Active',
      joiningDate: dto.joiningDate || new Date().toISOString().split('T')[0],
    });

    // Link user back to employee
    user.employeeDocId = employee._id;
    await user.save();

    // Create invitation record in invitations collection (with TTL cleanup)
    await this.invitationModel.create({
      email: employee.email,
      employeeId: employee._id,
      token: hashedActivationToken,
      status: 'Sent',
      expiresAt: tokenExpiresAt,
    });

    // Send invitation email with raw token
    await this.mailService.sendInvitationEmail(
      employee.email,
      rawActivationToken,
      employee.name,
    );

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'EMPLOYEE_CREATED',
      module: 'Employees',
      targetId: employee._id.toString(),
      details: {
        email: employee.email,
        employeeId,
        role: roleName,
        departmentId: deptId?.toString(),
      },
    });

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, currentUser?: CurrentUserPayload) {
    const employee = await this.findByIdOrEmployeeId(id);

    // Security check: Prevent users from self-elevating or changing their own security role
    if (
      currentUser &&
      employee.userId &&
      currentUser.userId === employee.userId.toString() &&
      (dto.roleId || dto.role)
    ) {
      throw new ForbiddenException(
        'Users cannot modify or elevate their own security role.',
      );
    }

    const updatePayload: any = { ...dto };

    // Validate relations if passed
    if (dto.departmentId !== undefined) {
      if (dto.departmentId) {
        updatePayload.departmentId = await this.validatorService.validateDepartment(dto.departmentId);
      } else {
        updatePayload.departmentId = null;
      }
    }

    const effectiveDeptId = updatePayload.departmentId || employee.departmentId;

    if (dto.teamId !== undefined) {
      if (dto.teamId) {
        updatePayload.teamId = await this.validatorService.validateTeam(dto.teamId, effectiveDeptId || undefined);
      } else {
        updatePayload.teamId = null;
      }
    }

    if (dto.positionId !== undefined) {
      if (dto.positionId) {
        updatePayload.positionId = await this.validatorService.validatePosition(dto.positionId, effectiveDeptId || undefined);
      } else {
        updatePayload.positionId = null;
      }
    }

    if (dto.roleId !== undefined) {
      if (dto.roleId) {
        const validatedRole = await this.validatorService.validateRole(dto.roleId);
        if (validatedRole) {
          // Security check: Only Super Admin can assign Super Admin role
          if (
            validatedRole.name === 'Super Admin' &&
            currentUser &&
            !currentUser.isSuperAdmin &&
            currentUser.role !== 'Super Admin'
          ) {
            throw new ForbiddenException(
              'Only Super Administrators can assign the Super Admin role.',
            );
          }
          updatePayload.roleId = validatedRole.id;
          updatePayload.role = validatedRole.name;
        }
      } else {
        updatePayload.roleId = null;
      }
    }

    if (
      dto.role === 'Super Admin' &&
      currentUser &&
      !currentUser.isSuperAdmin &&
      currentUser.role !== 'Super Admin'
    ) {
      throw new ForbiddenException(
        'Only Super Administrators can assign the Super Admin role.',
      );
    }

    const updated = await this.employeeModel
      .findByIdAndUpdate(employee._id, { $set: updatePayload }, { new: true })
      .populate('departmentId', 'name color code')
      .populate('teamId', 'name')
      .populate('positionId', 'title name')
      .populate('roleId', 'name')
      .lean();

    // Sync user if linked
    if (employee.userId) {
      const userUpdate: any = {};
      if (dto.name) userUpdate.name = dto.name;
      if (updatePayload.role) userUpdate.role = updatePayload.role;
      if (updatePayload.roleId !== undefined) userUpdate.roleId = updatePayload.roleId;
      if (updatePayload.departmentId !== undefined) userUpdate.departmentId = updatePayload.departmentId;
      if (updatePayload.teamId !== undefined) userUpdate.teamId = updatePayload.teamId;
      if (updatePayload.positionId !== undefined) userUpdate.positionId = updatePayload.positionId;
      if (Object.keys(userUpdate).length > 0) {
        await this.userModel.findByIdAndUpdate(employee.userId, { $set: userUpdate });
      }
    }

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'EMPLOYEE_UPDATED',
      module: 'Employees',
      targetId: employee._id.toString(),
      details: dto,
    });

    return updated;
  }

  async delete(id: string, currentUser?: CurrentUserPayload) {
    const employee = await this.findByIdOrEmployeeId(id);

    // Prevent self-deletion
    if (
      currentUser &&
      (currentUser.employeeDocId === employee._id.toString() ||
        (employee.userId && currentUser.userId === employee.userId.toString()))
    ) {
      throw new BadRequestException(
        'Users cannot delete or deactivate their own account.',
      );
    }

    await this.employeeModel.findByIdAndDelete(employee._id);

    if (employee.userId) {
      await this.userModel.findByIdAndUpdate(employee.userId, {
        status: UserStatus.DEACTIVATED,
        $unset: { employeeDocId: 1 },
      });
    }

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'EMPLOYEE_DELETED',
      module: 'Employees',
      targetId: employee._id.toString(),
      details: { email: employee.email, employeeId: employee.employeeId },
    });

    return { message: 'Employee deleted successfully' };
  }

  async suspend(id: string, currentUser?: CurrentUserPayload) {
    const employee = await this.findByIdOrEmployeeId(id);

    // Prevent self-suspension
    if (
      currentUser &&
      (currentUser.employeeDocId === employee._id.toString() ||
        (employee.userId && currentUser.userId === employee.userId.toString()))
    ) {
      throw new BadRequestException('Users cannot suspend their own account.');
    }

    const updatedEmp = await this.employeeModel
      .findByIdAndUpdate(employee._id, { status: 'Suspended' }, { new: true })
      .lean();

    if (employee.userId) {
      await this.userModel.findByIdAndUpdate(employee.userId, {
        status: UserStatus.SUSPENDED,
      });
    }

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'EMPLOYEE_SUSPENDED',
      module: 'Employees',
      targetId: employee._id.toString(),
      details: { email: employee.email, employeeId: employee.employeeId },
    });

    return {
      success: true,
      message: 'Employee suspended successfully',
      employee: updatedEmp,
    };
  }

  async reactivate(id: string, currentUser?: CurrentUserPayload) {
    const employee = await this.findByIdOrEmployeeId(id);

    const updatedEmp = await this.employeeModel
      .findByIdAndUpdate(employee._id, { status: 'Active' }, { new: true })
      .lean();

    if (employee.userId) {
      await this.userModel.findByIdAndUpdate(employee.userId, {
        status: UserStatus.ACTIVE,
      });
    }

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'EMPLOYEE_REACTIVATED',
      module: 'Employees',
      targetId: employee._id.toString(),
      details: { email: employee.email, employeeId: employee.employeeId },
    });

    return {
      success: true,
      message: 'Employee reactivated successfully',
      employee: updatedEmp,
    };
  }

  async deactivate(id: string, currentUser?: CurrentUserPayload) {
    const employee = await this.findByIdOrEmployeeId(id);

    // Prevent self-deactivation
    if (
      currentUser &&
      (currentUser.employeeDocId === employee._id.toString() ||
        (employee.userId && currentUser.userId === employee.userId.toString()))
    ) {
      throw new BadRequestException('Users cannot deactivate their own account.');
    }

    const updatedEmp = await this.employeeModel
      .findByIdAndUpdate(employee._id, { status: 'Deactivated' }, { new: true })
      .lean();

    if (employee.userId) {
      await this.userModel.findByIdAndUpdate(employee.userId, {
        status: UserStatus.DEACTIVATED,
      });
    }

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'EMPLOYEE_DEACTIVATED',
      module: 'Employees',
      targetId: employee._id.toString(),
      details: { email: employee.email, employeeId: employee.employeeId },
    });

    return {
      success: true,
      message: 'Employee deactivated successfully',
      employee: updatedEmp,
    };
  }

  async onboardUid(dto: OnboardUidDto, currentUser?: CurrentUserPayload) {
    const firebaseUid = dto.firebaseUid || dto.uid;
    if (!firebaseUid && !dto.email) {
      throw new BadRequestException('Either firebaseUid or email must be provided for onboarding');
    }

    let user: UserDocument | null = null;
    if (firebaseUid) {
      user = await this.userModel.findOne({ firebaseUid });
    }
    if (!user && dto.email) {
      user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    }

    // Validate relationships if provided
    let deptId: Types.ObjectId | null = null;
    let teamId: Types.ObjectId | null = null;
    let posId: Types.ObjectId | null = null;
    let roleId: Types.ObjectId | null = null;
    let roleName = 'Employee';

    if (dto.departmentId) {
      deptId = await this.validatorService.validateDepartment(dto.departmentId);
    }
    if (dto.teamId) {
      teamId = await this.validatorService.validateTeam(dto.teamId, deptId || undefined);
    }
    if (dto.positionId) {
      posId = await this.validatorService.validatePosition(dto.positionId, deptId || undefined);
    }
    if (dto.roleId) {
      const validatedRole = await this.validatorService.validateRole(dto.roleId);
      if (validatedRole) {
        if (
          validatedRole.name === 'Super Admin' &&
          currentUser &&
          !currentUser.isSuperAdmin &&
          currentUser.role !== 'Super Admin'
        ) {
          throw new ForbiddenException(
            'Only Super Administrators can assign the Super Admin role.',
          );
        }
        roleId = validatedRole.id;
        roleName = validatedRole.name;
      }
    }

    if (!user) {
      const email = dto.email ? dto.email.toLowerCase() : `${firebaseUid}@firebase.user`;
      const name = dto.name || email.split('@')[0];
      user = await this.userModel.create({
        email,
        name,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
        role: roleName,
        roleId,
        departmentId: deptId,
        teamId,
        positionId: posId,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        firebaseUid,
      });
    } else {
      if (firebaseUid) user.firebaseUid = firebaseUid;
      user.status = UserStatus.ACTIVE;
      user.isEmailVerified = true;
      if (roleName) user.role = roleName;
      if (roleId) user.roleId = roleId;
      if (deptId) user.departmentId = deptId;
      if (teamId) user.teamId = teamId;
      if (posId) user.positionId = posId;
      await user.save();
    }

    let employee = await this.employeeModel.findOne({
      $or: [{ userId: user._id }, { email: user.email.toLowerCase() }],
    });

    if (!employee) {
      const employeeId = await this.sequenceService.getNextSequence(
        'employeeId',
        'EMP-',
        6,
      );
      employee = await this.employeeModel.create({
        employeeId,
        name: user.name,
        email: user.email,
        userId: user._id,
        departmentId: deptId,
        teamId,
        positionId: posId,
        roleId,
        role: roleName,
        status: 'Active',
        joiningDate: dto.joiningDate || new Date().toISOString().split('T')[0],
      });
    } else {
      employee.departmentId = deptId || employee.departmentId;
      employee.teamId = teamId || employee.teamId;
      employee.positionId = posId || employee.positionId;
      employee.roleId = roleId || employee.roleId;
      employee.role = roleName || employee.role;
      employee.status = 'Active';
      await employee.save();
    }

    user.employeeDocId = employee._id;
    await user.save();

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'EMPLOYEE_ONBOARDED_FIREBASE',
      module: 'Employees',
      targetId: employee._id.toString(),
      details: {
        firebaseUid,
        email: employee.email,
        employeeId: employee.employeeId,
        role: roleName,
      },
    });

    return {
      success: true,
      message: 'Employee onboarded and linked successfully',
      user,
      employee,
    };
  }
}

