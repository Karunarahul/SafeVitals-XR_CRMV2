import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessRequest, AccessRequestDocument } from './schemas/access-request.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import {
  CreateAccessRequestDto,
  RejectAccessRequestDto,
  ReviewAccessRequestDto,
} from './dto/access-request.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AccessRequestsService {
  constructor(
    @InjectModel(AccessRequest.name)
    private readonly accessRequestModel: Model<AccessRequestDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.status) {
      filter.$or = [{ status: query.status }, { status: query.status.toLowerCase() }];
    }
    if (query?.userId && Types.ObjectId.isValid(query.userId)) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    const limit = query?.limit ? parseInt(query.limit, 10) : 50;

    return this.accessRequestModel
      .find(filter)
      .populate('userId', 'name email role employeeDocId')
      .populate('targetRoleId', 'name')
      .populate('targetDepartmentId', 'name')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async create(currentUser: CurrentUserPayload, dto: CreateAccessRequestDto) {
    const reqType = dto.requestType || dto.requestedSystem || 'System Access';
    const reqSystem = dto.requestedSystem || dto.requestType || 'System Access';

    const payload: any = {
      ...dto,
      requestType: reqType,
      requestedSystem: reqSystem,
      userId: new Types.ObjectId(currentUser.userId),
      status: 'Pending',
    };

    if (currentUser.employeeDocId && Types.ObjectId.isValid(currentUser.employeeDocId)) {
      payload.employeeDocId = new Types.ObjectId(currentUser.employeeDocId);
      payload.employeeId = new Types.ObjectId(currentUser.employeeDocId);
    }
    if (dto.targetRoleId && Types.ObjectId.isValid(dto.targetRoleId)) {
      payload.targetRoleId = new Types.ObjectId(dto.targetRoleId);
    }
    if (dto.targetDepartmentId && Types.ObjectId.isValid(dto.targetDepartmentId)) {
      payload.targetDepartmentId = new Types.ObjectId(dto.targetDepartmentId);
    }

    const created = await this.accessRequestModel.create(payload);

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'ACCESS_REQUEST_SUBMITTED',
      module: 'AccessRequests',
      targetId: created._id.toString(),
      details: {
        requestedSystem: reqSystem,
        reason: dto.reason,
      },
    });

    return created;
  }

  async approve(id: string, reviewerId: string, currentUser?: CurrentUserPayload, note?: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const req = await this.accessRequestModel.findById(id);
    if (!req) throw new NotFoundException('Access request not found');

    const currentStatus = (req.status || '').toLowerCase();
    if (currentStatus !== 'pending') {
      throw new BadRequestException(`Access request is already ${req.status}`);
    }

    req.status = 'Approved';
    req.reviewedBy = new Types.ObjectId(reviewerId);
    req.reviewerId = new Types.ObjectId(reviewerId);
    req.reviewedAt = new Date();
    if (note) {
      req.reviewNotes = note;
      req.reviewNote = note;
    }
    await req.save();

    // If request has targetRoleId, update user role
    if (req.targetRoleId) {
      const role = await this.roleModel.findById(req.targetRoleId);
      if (role) {
        await this.userModel.findByIdAndUpdate(req.userId, {
          role: role.name,
          roleId: role._id,
        });
        if (req.employeeDocId) {
          await this.employeeModel.findByIdAndUpdate(req.employeeDocId, {
            role: role.name,
            roleId: role._id,
          });
        }
      }
    }

    // If request has targetDepartmentId, update department
    if (req.targetDepartmentId) {
      await this.userModel.findByIdAndUpdate(req.userId, {
        departmentId: req.targetDepartmentId,
      });
      if (req.employeeDocId) {
        await this.employeeModel.findByIdAndUpdate(req.employeeDocId, {
          departmentId: req.targetDepartmentId,
        });
      }
    }

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'ACCESS_REQUEST_APPROVED',
      module: 'AccessRequests',
      targetId: id,
      details: {
        requestedSystem: req.requestedSystem,
        targetRoleId: req.targetRoleId?.toString(),
      },
    });

    return req;
  }

  async reject(id: string, reviewerId: string, dto: RejectAccessRequestDto, currentUser?: CurrentUserPayload) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const req = await this.accessRequestModel.findById(id);
    if (!req) throw new NotFoundException('Access request not found');

    const currentStatus = (req.status || '').toLowerCase();
    if (currentStatus !== 'pending') {
      throw new BadRequestException(`Access request is already ${req.status}`);
    }

    req.status = 'Rejected';
    req.reviewedBy = new Types.ObjectId(reviewerId);
    req.reviewerId = new Types.ObjectId(reviewerId);
    req.reviewedAt = new Date();
    const note = dto.reviewNotes || dto.note || '';
    req.reviewNotes = note;
    req.reviewNote = note;
    await req.save();

    // Audit Log
    await this.auditService.log(currentUser, {
      action: 'ACCESS_REQUEST_REJECTED',
      module: 'AccessRequests',
      targetId: id,
      details: {
        note,
      },
    });

    return req;
  }

  async review(id: string, currentUser: CurrentUserPayload, dto: ReviewAccessRequestDto) {
    const status = (dto.status || '').toLowerCase();
    const note = dto.note || dto.reviewNotes || '';

    if (status === 'approved') {
      const updated = await this.approve(id, currentUser.userId, currentUser, note);
      return {
        success: true,
        message: 'Access request approved successfully',
        data: updated,
      };
    } else if (status === 'rejected') {
      const updated = await this.reject(id, currentUser.userId, { reviewNotes: note }, currentUser);
      return {
        success: true,
        message: 'Access request rejected successfully',
        data: updated,
      };
    } else {
      throw new BadRequestException("Status must be either 'Approved' or 'Rejected'");
    }
  }
}

