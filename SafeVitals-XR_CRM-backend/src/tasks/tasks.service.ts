import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
  ) {}

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.status) filter.status = query.status;
    if (query?.priority) filter.priority = query.priority;
    if (query?.assigneeId && Types.ObjectId.isValid(query.assigneeId)) {
      filter.assigneeId = new Types.ObjectId(query.assigneeId);
    }
    if (query?.reporterId && Types.ObjectId.isValid(query.reporterId)) {
      filter.reporterId = new Types.ObjectId(query.reporterId);
    }

    return this.taskModel
      .find(filter)
      .populate('assigneeId', 'name email employeeId avatar')
      .populate('reporterId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const task = await this.taskModel
      .findById(id)
      .populate('assigneeId', 'name email employeeId avatar')
      .populate('reporterId', 'name email')
      .lean();
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(reporterId: string, dto: CreateTaskDto) {
    const payload: any = {
      ...dto,
      reporterId: new Types.ObjectId(reporterId),
    };
    if (dto.assigneeId && Types.ObjectId.isValid(dto.assigneeId)) {
      payload.assigneeId = new Types.ObjectId(dto.assigneeId);
    }
    return this.taskModel.create(payload);
  }

  async update(id: string, dto: UpdateTaskDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const payload: any = { ...dto };
    if (dto.assigneeId && Types.ObjectId.isValid(dto.assigneeId)) {
      payload.assigneeId = new Types.ObjectId(dto.assigneeId);
    }
    const updated = await this.taskModel
      .findByIdAndUpdate(id, { $set: payload }, { new: true })
      .populate('assigneeId', 'name email employeeId avatar')
      .populate('reporterId', 'name email')
      .lean();
    if (!updated) throw new NotFoundException('Task not found');
    return updated;
  }

  async updateStatus(id: string, dto: UpdateTaskStatusDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const updated = await this.taskModel
      .findByIdAndUpdate(id, { $set: { status: dto.status } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Task not found');
    return updated;
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const res = await this.taskModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Task not found');
    return { message: 'Task deleted successfully' };
  }
}
