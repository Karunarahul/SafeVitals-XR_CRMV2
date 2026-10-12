import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Schedule, ScheduleDocument } from './schemas/schedule.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { CreateScheduleDto, BulkCreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(Schedule.name)
    private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
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
    if (!emp) throw new BadRequestException('No linked employee record');
    return emp;
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
    if (query?.date) filter.date = query.date;
    if (query?.startDate && query?.endDate) {
      filter.date = { $gte: query.startDate, $lte: query.endDate };
    }

    return this.scheduleModel
      .find(filter)
      .populate('employeeDocId', 'name email employeeId avatar')
      .sort({ date: 1 })
      .lean();
  }

  async findMySchedule(currentUser: CurrentUserPayload, query?: any) {
    const emp = await this.resolveEmployee(currentUser);
    const filter: any = {
      $or: [{ employeeDocId: emp._id }, { employeeId: emp.employeeId }],
    };
    if (query?.startDate && query?.endDate) {
      filter.date = { $gte: query.startDate, $lte: query.endDate };
    }
    return this.scheduleModel.find(filter).sort({ date: 1 }).lean();
  }

  async create(dto: CreateScheduleDto) {
    if (dto.employeeId) {
      let emp: EmployeeDocument | null = null;
      if (Types.ObjectId.isValid(dto.employeeId)) {
        emp = await this.employeeModel.findById(dto.employeeId);
      }
      if (!emp) {
        emp = await this.employeeModel.findOne({ employeeId: dto.employeeId });
      }
      if (!emp) throw new NotFoundException('Employee not found');

      const dateStr = dto.date || new Date().toISOString().split('T')[0];
      return this.scheduleModel.findOneAndUpdate(
        { employeeDocId: emp._id, date: dateStr },
        {
          $set: {
            name: dto.name || 'Standard Shift',
            employeeId: emp.employeeId,
            employeeDocId: emp._id,
            date: dateStr,
            shiftStart: dto.shiftStart || dto.startTime || '09:00',
            startTime: dto.startTime || dto.shiftStart || '09:00',
            shiftEnd: dto.shiftEnd || dto.endTime || '17:00',
            endTime: dto.endTime || dto.shiftEnd || '17:00',
            workDays: dto.workDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            type: dto.type || 'work',
            notes: dto.notes || '',
          },
        },
        { upsert: true, new: true },
      );
    }

    return this.scheduleModel.create({
      name: dto.name || 'Standard Shift',
      shiftStart: dto.shiftStart || dto.startTime || '09:00',
      startTime: dto.startTime || dto.shiftStart || '09:00',
      shiftEnd: dto.shiftEnd || dto.endTime || '17:00',
      endTime: dto.endTime || dto.shiftEnd || '17:00',
      workDays: dto.workDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      type: dto.type || 'work',
      notes: dto.notes || '',
    });
  }

  async bulkCreate(dto: BulkCreateScheduleDto) {
    const results = [];
    for (const item of dto.schedules) {
      const res = await this.create(item);
      results.push(res);
    }
    return results;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const updated = await this.scheduleModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Schedule not found');
    return updated;
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const res = await this.scheduleModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Schedule not found');
    return { message: 'Schedule deleted successfully' };
  }
}
