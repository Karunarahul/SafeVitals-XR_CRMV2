import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, UserDocument, UserStatus } from './schemas/user.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { SequenceService } from '../database/sequence.service';
import { ReferenceValidatorService } from '../database/reference-validator.service';
import { AuditService } from '../audit/audit.service';
import { ApproveCandidateDto, RejectCandidateDto, UpdateUserDto } from './dto/users.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly sequenceService: SequenceService,
    private readonly validatorService: ReferenceValidatorService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.userModel.find().lean();
  }

  async findPending() {
    return this.userModel.find({ status: UserStatus.PENDING }).lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async approveCandidate(
    userId: string,
    dto: ApproveCandidateDto,
    currentUser: CurrentUserPayload,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Security check: Prevent administrators from approving themselves
    if (currentUser && currentUser.userId === userId) {
      throw new BadRequestException(
        'Administrators cannot approve their own registration requests.',
      );
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent duplicate processing of the same approval request
    if (user.status === UserStatus.ACTIVE && user.employeeDocId) {
      throw new BadRequestException('Candidate is already approved and active');
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
        // Security check: Non-super administrators cannot assign Super Admin role
        if (
          validatedRole.name === 'Super Admin' &&
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

    // Generate auto employee ID: EMP-000001
    const employeeId = await this.sequenceService.getNextSequence(
      'employeeId',
      'EMP-',
      6,
    );

    // Create Employee record
    const employee = await this.employeeModel.create({
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
      joiningDate: new Date().toISOString().split('T')[0],
    });

    // Update User
    user.status = UserStatus.ACTIVE;
    user.isEmailVerified = true;
    user.role = roleName;
    user.roleId = roleId;
    user.departmentId = deptId;
    user.teamId = teamId;
    user.positionId = posId;
    user.employeeDocId = employee._id;
    await user.save();

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'USER_APPROVED',
      module: 'Users',
      targetId: userId,
      details: {
        email: user.email,
        role: roleName,
        departmentId: deptId?.toString(),
        employeeId,
      },
    });

    return {
      success: true,
      message: 'Candidate approved and converted to active employee successfully',
      user,
      employee,
    };
  }

  async rejectCandidate(
    userId: string,
    dto: RejectCandidateDto,
    currentUser: CurrentUserPayload,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    if (currentUser && currentUser.userId === userId) {
      throw new BadRequestException('Administrators cannot reject their own account.');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('Active users must be deactivated, not rejected.');
    }

    user.status = UserStatus.DEACTIVATED;
    await user.save();

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'USER_REJECTED',
      module: 'Users',
      targetId: userId,
      details: {
        email: user.email,
        reason: dto?.reason || 'Candidate registration rejected',
      },
    });

    return {
      success: true,
      message: 'Candidate registration rejected successfully',
    };
  }

  async update(id: string, dto: UpdateUserDto, currentUser: CurrentUserPayload) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Security check: Prevent users from self-elevating their roles
    if (currentUser && currentUser.userId === id && (dto.role || dto.roleId)) {
      throw new ForbiddenException(
        'Users cannot modify or elevate their own security role.',
      );
    }

    // Security check: Only Super Admin can assign Super Admin role
    if (
      (dto.role === 'Super Admin' || dto.roleId) &&
      !currentUser.isSuperAdmin &&
      currentUser.role !== 'Super Admin'
    ) {
      if (dto.roleId) {
        const targetRole = await this.roleModel.findById(dto.roleId).lean();
        if (targetRole && targetRole.name === 'Super Admin') {
          throw new ForbiddenException(
            'Only Super Administrators can assign the Super Admin role.',
          );
        }
      } else if (dto.role === 'Super Admin') {
        throw new ForbiddenException(
          'Only Super Administrators can assign the Super Admin role.',
        );
      }
    }

    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('User not found');

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'USER_UPDATED',
      module: 'Users',
      targetId: id,
      details: dto,
    });

    return updated;
  }

  async delete(id: string, currentUser: CurrentUserPayload) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    if (currentUser && currentUser.userId === id) {
      throw new BadRequestException(
        'Users cannot delete or deactivate their own account.',
      );
    }

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (user.employeeDocId) {
      await this.employeeModel.findByIdAndUpdate(user.employeeDocId, {
        status: 'Deactivated',
      });
    }

    user.status = UserStatus.DEACTIVATED;
    await user.save();

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'USER_DEACTIVATED',
      module: 'Users',
      targetId: id,
      details: { email: user.email },
    });

    return {
      success: true,
      message: 'User deactivated successfully',
    };
  }
}

