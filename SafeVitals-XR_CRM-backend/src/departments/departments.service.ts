import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name)
    private readonly deptModel: Model<DepartmentDocument>,
  ) {}

  async findAll() {
    return this.deptModel.find().populate('managerId', 'name email employeeId').lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const dept = await this.deptModel.findById(id).populate('managerId', 'name email employeeId').lean();
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const payload: any = { ...dto };
    if (dto.managerId && Types.ObjectId.isValid(dto.managerId)) {
      payload.managerId = new Types.ObjectId(dto.managerId);
    }
    return this.deptModel.create(payload);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const payload: any = { ...dto };
    if (dto.managerId && Types.ObjectId.isValid(dto.managerId)) {
      payload.managerId = new Types.ObjectId(dto.managerId);
    }
    const updated = await this.deptModel
      .findByIdAndUpdate(id, { $set: payload }, { new: true })
      .populate('managerId', 'name email employeeId')
      .lean();
    if (!updated) throw new NotFoundException('Department not found');
    return updated;
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const res = await this.deptModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Department not found');
    return { message: 'Department deleted successfully' };
  }

  async archive(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const dept = await this.deptModel.findById(id);
    if (!dept) throw new NotFoundException('Department not found');
    dept.isArchived = !dept.isArchived;
    await dept.save();
    return dept;
  }
}
