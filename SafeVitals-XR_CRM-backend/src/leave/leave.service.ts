import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Leave, LeaveDocument } from './schemas/leave.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { OrgSettings, OrgSettingsDocument } from '../org-settings/schemas/org-settings.schema';
import { CreateLeaveDto, RejectLeaveDto } from './dto/leave.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@Injectable()
export class LeaveService {
  constructor(
    @InjectModel(Leave.name) private readonly leaveModel: Model<LeaveDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(OrgSettings.name) private readonly orgSettingsModel: Model<OrgSettingsDocument>,
  ) {}

  private async resolveEmployee(user: CurrentUserPayload): Promise<EmployeeDocument> {
    let emp: EmployeeDocument | null = null;
    if (user.employeeDocId && Types.ObjectId.isValid(user.employeeDocId)) {
      emp = await this.employeeModel.findById(user.employeeDocId);
    }
    if (!emp && user.userId && Types.ObjectId.isValid(user.userId)) {
      emp = await this.employeeModel.findOne({ userId: new Types.ObjectId(user.userId) });
    }
    if (!emp && user.employeeId) {
      emp = await this.employeeModel.findOne({ employeeId: user.employeeId });
    }
    if (!emp) {
      throw new BadRequestException('No employee record associated with current user');
    }
    return emp;
  }

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.status) {
      filter.$or = [{ status: query.status }, { status: query.status.toLowerCase() }];
    }
    if (query?.type) {
      filter.$or = [{ type: query.type }, { leaveType: query.type }];
    }
    if (query?.employeeId) {
      filter.$or = [
        { employeeId: query.employeeId },
        ...(Types.ObjectId.isValid(query.employeeId)
          ? [{ employeeDocId: new Types.ObjectId(query.employeeId) }]
          : []),
      ];
    }

    return this.leaveModel
      .find(filter)
      .populate('employeeDocId', 'name email employeeId avatar departmentId')
      .populate('reviewedBy', 'name email')
      .populate('reviewerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findMyLeaves(currentUser: CurrentUserPayload) {
    const emp = await this.resolveEmployee(currentUser);
    return this.leaveModel
      .find({
        $or: [{ employeeDocId: emp._id }, { employeeId: emp.employeeId }, { userId: emp.userId }],
      })
      .populate('reviewedBy', 'name email')
      .populate('reviewerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getLeaveBalance(currentUser: CurrentUserPayload) {
    const emp = await this.resolveEmployee(currentUser);
    const org = await this.orgSettingsModel.findOne().lean();

    const annualTotal = org?.leavePolicy?.annualDays || 20;
    const sickTotal = org?.leavePolicy?.sickDays || 10;
    const casualTotal = 5;

    // Sum approved leaves for current year
    const currentYear = new Date().getFullYear().toString();
    const approvedLeaves = await this.leaveModel.find({
      $or: [{ employeeDocId: emp._id }, { employeeId: emp.employeeId }],
      status: { $in: ['approved', 'Approved'] },
      startDate: { $regex: `^${currentYear}` },
    });

    const annualUsed = approvedLeaves
      .filter((l) => (l.type || l.leaveType || '').toLowerCase() === 'annual')
      .reduce((sum, l) => sum + (l.days || 1), 0);

    const sickUsed = approvedLeaves
      .filter((l) => (l.type || l.leaveType || '').toLowerCase() === 'sick')
      .reduce((sum, l) => sum + (l.days || 1), 0);

    const casualUsed = approvedLeaves
      .filter((l) => (l.type || l.leaveType || '').toLowerCase() === 'casual')
      .reduce((sum, l) => sum + (l.days || 1), 0);

    return {
      annual: { total: annualTotal, used: annualUsed, remaining: Math.max(0, annualTotal - annualUsed) },
      sick: { total: sickTotal, used: sickUsed, remaining: Math.max(0, sickTotal - sickUsed) },
      casual: { total: casualTotal, used: casualUsed, remaining: Math.max(0, casualTotal - casualUsed) },
      totalUsed: annualUsed + sickUsed + casualUsed,
    };
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const leave = await this.leaveModel
      .findById(id)
      .populate('employeeDocId', 'name email employeeId avatar departmentId')
      .populate('reviewedBy', 'name email')
      .populate('reviewerId', 'name email')
      .lean();
    if (!leave) throw new NotFoundException('Leave request not found');
    return leave;
  }

  async create(currentUser: CurrentUserPayload, dto: CreateLeaveDto) {
    let emp: EmployeeDocument;
    if (dto.employeeId && (currentUser.role === 'Super Admin' || currentUser.role === 'Manager')) {
      if (Types.ObjectId.isValid(dto.employeeId)) {
        emp = await this.employeeModel.findById(dto.employeeId);
      } else {
        emp = await this.employeeModel.findOne({ employeeId: dto.employeeId });
      }
      if (!emp) throw new NotFoundException('Target employee not found');
    } else {
      emp = await this.resolveEmployee(currentUser);
    }

    const rawType = dto.type || dto.leaveType || 'casual';
    let days = dto.days;
    if (!days || isNaN(days)) {
      const start = new Date(dto.startDate).getTime();
      const end = new Date(dto.endDate).getTime();
      const diff = Math.max(0, end - start);
      days = Math.max(1, Math.round(diff / (1000 * 3600 * 24)) + 1);
    }

    return this.leaveModel.create({
      employeeId: emp.employeeId,
      employeeDocId: emp._id,
      userId: emp.userId,
      type: rawType.toLowerCase(),
      leaveType: rawType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days,
      reason: dto.reason || '',
      status: 'pending',
    });
  }

  async approve(id: string, reviewerId: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const leave = await this.leaveModel.findById(id);
    if (!leave) throw new NotFoundException('Leave request not found');

    // Strict status transition validation
    const currentStatus = (leave.status || '').toLowerCase();
    if (currentStatus !== 'pending') {
      throw new BadRequestException(
        `Invalid status transition: cannot approve a leave request that is already '${leave.status}'`,
      );
    }

    leave.status = 'approved';
    leave.reviewedBy = new Types.ObjectId(reviewerId);
    leave.reviewerId = new Types.ObjectId(reviewerId);
    leave.reviewedAt = new Date();
    await leave.save();
    return leave;
  }

  async reject(id: string, reviewerId: string, dto: RejectLeaveDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const leave = await this.leaveModel.findById(id);
    if (!leave) throw new NotFoundException('Leave request not found');

    // Strict status transition validation
    const currentStatus = (leave.status || '').toLowerCase();
    if (currentStatus !== 'pending') {
      throw new BadRequestException(
        `Invalid status transition: cannot reject a leave request that is already '${leave.status}'`,
      );
    }

    leave.status = 'rejected';
    leave.reviewedBy = new Types.ObjectId(reviewerId);
    leave.reviewerId = new Types.ObjectId(reviewerId);
    leave.reviewedAt = new Date();
    leave.rejectionReason = dto.reason;
    leave.reviewNote = dto.reason;
    await leave.save();
    return leave;
  }

  async cancel(id: string, currentUser: CurrentUserPayload) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const leave = await this.leaveModel.findById(id);
    if (!leave) throw new NotFoundException('Leave request not found');

    const emp = await this.resolveEmployee(currentUser);
    const isOwner =
      leave.employeeDocId?.toString() === emp._id.toString() ||
      leave.employeeId === emp.employeeId ||
      leave.userId?.toString() === currentUser.userId;

    if (!isOwner && currentUser.role !== 'Super Admin') {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    const currentStatus = (leave.status || '').toLowerCase();
    if (currentStatus !== 'pending') {
      throw new BadRequestException(
        `Invalid status transition: cannot cancel a leave request that is already '${leave.status}'`,
      );
    }

    leave.status = 'cancelled';
    await leave.save();
    return leave;
  }
}
