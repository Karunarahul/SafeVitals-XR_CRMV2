import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import {
  CheckInDto,
  CheckOutDto,
  ManualAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async resolveEmployee(user: CurrentUserPayload, targetEmployeeId?: string): Promise<EmployeeDocument> {
    let emp: EmployeeDocument | null = null;
    if (targetEmployeeId) {
      if (Types.ObjectId.isValid(targetEmployeeId)) {
        emp = await this.employeeModel.findById(targetEmployeeId);
      }
      if (!emp) {
        emp = await this.employeeModel.findOne({ employeeId: targetEmployeeId });
      }
      if (!emp && Types.ObjectId.isValid(targetEmployeeId)) {
        emp = await this.employeeModel.findOne({ userId: new Types.ObjectId(targetEmployeeId) });
      }
    }
    if (!emp) {
      if (user.employeeDocId && Types.ObjectId.isValid(user.employeeDocId)) {
        emp = await this.employeeModel.findById(user.employeeDocId);
      }
      if (!emp && user.userId && Types.ObjectId.isValid(user.userId)) {
        emp = await this.employeeModel.findOne({ userId: new Types.ObjectId(user.userId) });
      }
      if (!emp && user.employeeId) {
        emp = await this.employeeModel.findOne({ employeeId: user.employeeId });
      }
    }
    if (!emp) {
      throw new BadRequestException('No employee record linked to the specified or current user');
    }
    return emp;
  }

  async getMyToday(currentUser: CurrentUserPayload, targetEmployeeId?: string) {
    const emp = await this.resolveEmployee(currentUser, targetEmployeeId);
    const today = this.getTodayString();

    let record = await this.attendanceModel
      .findOne({
        $or: [
          { employeeDocId: emp._id, date: today },
          { employeeId: emp.employeeId, date: today },
        ],
      })
      .lean();

    return record || null;
  }

  async checkIn(currentUser: CurrentUserPayload, dto: CheckInDto, targetEmployeeId?: string) {
    const emp = await this.resolveEmployee(currentUser, targetEmployeeId);
    const today = this.getTodayString();

    const locationObj = typeof dto.location === 'string'
      ? { address: dto.location }
      : (dto.location && typeof dto.location === 'object' ? dto.location : undefined);

    // Prevent duplicate check-in for the same date/shift
    const existing = await this.attendanceModel.findOne({
      $or: [
        { employeeDocId: emp._id, date: today },
        { employeeId: emp.employeeId, date: today },
      ],
    });

    if (existing && (existing.checkIn || existing.checkInAt)) {
      throw new BadRequestException('You have already checked in for today');
    }

    const now = new Date();
    if (existing) {
      existing.checkIn = now;
      existing.checkInAt = now;
      existing.status = 'present';
      if (dto.workMode) existing.workMode = dto.workMode;
      if (dto.notes) existing.notes = dto.notes;
      if (locationObj) existing.location = locationObj as any;
      await existing.save();
      return existing;
    }

    try {
      return await this.attendanceModel.create({
        employeeId: emp.employeeId,
        employeeDocId: emp._id,
        userId: emp.userId,
        date: today,
        checkIn: now,
        checkInAt: now,
        status: 'present',
        workMode: dto.workMode || 'office',
        breaks: [],
        ...(locationObj ? { location: locationObj } : {}),
      });
    } catch (err: any) {
      if (err.code === 11000) {
        throw new BadRequestException('You have already checked in for today');
      }
      throw err;
    }
  }

  async startBreak(currentUser: CurrentUserPayload, targetEmployeeId?: string) {
    const emp = await this.resolveEmployee(currentUser, targetEmployeeId);
    const today = this.getTodayString();

    const record = await this.attendanceModel.findOne({
      $or: [
        { employeeDocId: emp._id, date: today },
        { employeeId: emp.employeeId, date: today },
      ],
    });

    if (!record || (!record.checkIn && !record.checkInAt)) {
      throw new BadRequestException('You must check in before taking a break');
    }

    if (record.checkOut || record.checkOutAt) {
      throw new BadRequestException('You have already checked out for today');
    }

    if (!record.breaks) {
      record.breaks = [];
    }

    const activeBreak = record.breaks.find((b) => !b.end);
    if (activeBreak) {
      throw new BadRequestException('A break session is already in progress');
    }

    record.breaks.push({
      start: new Date(),
      durationMinutes: 0,
    });
    record.status = 'On Break';

    await record.save();
    return record;
  }

  async endBreak(currentUser: CurrentUserPayload, targetEmployeeId?: string) {
    const emp = await this.resolveEmployee(currentUser, targetEmployeeId);
    const today = this.getTodayString();

    const record = await this.attendanceModel.findOne({
      $or: [
        { employeeDocId: emp._id, date: today },
        { employeeId: emp.employeeId, date: today },
      ],
    });

    if (!record) {
      throw new BadRequestException('No attendance record found for today');
    }

    if (!record.breaks) {
      record.breaks = [];
    }

    const activeBreak = record.breaks.find((b) => !b.end);
    if (!activeBreak) {
      throw new BadRequestException('No active break to resume from');
    }

    const now = new Date();
    activeBreak.end = now;
    const durationMs = now.getTime() - new Date(activeBreak.start).getTime();
    activeBreak.durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));
    record.status = 'present';

    await record.save();
    return record;
  }

  async checkOut(currentUser: CurrentUserPayload, dto: CheckOutDto, targetEmployeeId?: string) {
    const emp = await this.resolveEmployee(currentUser, targetEmployeeId);
    const today = this.getTodayString();

    const record = await this.attendanceModel.findOne({
      $or: [
        { employeeDocId: emp._id, date: today },
        { employeeId: emp.employeeId, date: today },
      ],
    });

    if (!record || (!record.checkIn && !record.checkInAt)) {
      throw new BadRequestException('You have not checked in today');
    }

    if (record.checkOut || record.checkOutAt) {
      throw new BadRequestException('You have already checked out today');
    }

    const now = new Date();
    const activeBreak = record.breaks.find((b) => !b.end);
    if (activeBreak) {
      activeBreak.end = now;
      const durationMs = now.getTime() - new Date(activeBreak.start).getTime();
      activeBreak.durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));
    }

    record.checkOut = now;
    record.checkOutAt = now;
    record.status = 'Checked Out';
    if (dto.notes) {
      record.notes = record.notes ? `${record.notes} | ${dto.notes}` : dto.notes;
    }

    const checkInTime = record.checkInAt || record.checkIn;
    const totalMs = now.getTime() - new Date(checkInTime).getTime();
    const totalMins = Math.round(totalMs / (1000 * 60));
    const totalBreakMins = record.breaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
    record.totalWorkMinutes = Math.max(0, totalMins - totalBreakMins);
    record.totalWorkHours = Number((record.totalWorkMinutes / 60).toFixed(2));

    if (record.totalWorkMinutes > 480) {
      record.overtimeMinutes = record.totalWorkMinutes - 480;
    }

    await record.save();
    return record;
  }

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.employeeId) {
      filter.$or = [
        { employeeId: query.employeeId },
        ...(Types.ObjectId.isValid(query.employeeId)
          ? [{ employeeDocId: new Types.ObjectId(query.employeeId) }]
          : []),
      ];
    }
    if (query?.date) {
      filter.date = query.date;
    }
    if (query?.startDate && query?.endDate) {
      filter.date = { $gte: query.startDate, $lte: query.endDate };
    }

    return this.attendanceModel
      .find(filter)
      .populate('employeeDocId', 'name email employeeId avatar')
      .sort({ date: -1 })
      .lean();
  }

  async getTodaySummary() {
    const today = this.getTodayString();
    const records = await this.attendanceModel.find({ date: today }).lean();
    const totalEmployees = await this.employeeModel.countDocuments({ status: 'Active' });

    const present = records.filter((r) => r.status === 'present' || r.status === 'Working' || r.status === 'Checked Out').length;
    const late = records.filter((r) => r.status === 'late' || r.status === 'Late').length;
    const halfDay = records.filter((r) => r.status === 'half_day').length;
    const onLeave = records.filter((r) => r.status === 'on_leave' || r.status === 'On Leave').length;
    const absent = Math.max(0, totalEmployees - (present + late + halfDay + onLeave));

    return {
      date: today,
      totalEmployees,
      present,
      late,
      halfDay,
      onLeave,
      absent,
    };
  }

  async createManual(dto: ManualAttendanceDto) {
    const checkInDate = dto.checkIn ? new Date(dto.checkIn) : new Date();
    const checkOutDate = dto.checkOut ? new Date(dto.checkOut) : undefined;
    return this.attendanceModel.create({
      ...dto,
      checkIn: checkInDate,
      checkInAt: checkInDate,
      checkOut: checkOutDate,
      checkOutAt: checkOutDate,
    });
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const updatePayload: any = { ...dto };
    if (dto.checkIn) {
      updatePayload.checkIn = new Date(dto.checkIn);
      updatePayload.checkInAt = new Date(dto.checkIn);
    }
    if (dto.checkOut) {
      updatePayload.checkOut = new Date(dto.checkOut);
      updatePayload.checkOutAt = new Date(dto.checkOut);
    }
    const updated = await this.attendanceModel
      .findByIdAndUpdate(id, { $set: updatePayload }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Attendance record not found');
    return updated;
  }
}
