import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Position, PositionDocument } from './schemas/position.schema';
import { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';
import { ReferenceValidatorService } from '../database/reference-validator.service';

@Injectable()
export class PositionsService {
  constructor(
    @InjectModel(Position.name)
    private readonly positionModel: Model<PositionDocument>,
    private readonly validatorService: ReferenceValidatorService,
  ) {}

  async findAll(departmentId?: string) {
    const filter: any = {};
    if (departmentId && Types.ObjectId.isValid(departmentId)) {
      filter.departmentId = new Types.ObjectId(departmentId);
    }
    return this.positionModel
      .find(filter)
      .populate('departmentId', 'name color code')
      .lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const pos = await this.positionModel
      .findById(id)
      .populate('departmentId', 'name color code')
      .lean();
    if (!pos) throw new NotFoundException('Position not found');
    return pos;
  }

  async create(dto: CreatePositionDto) {
    const deptId = await this.validatorService.validateDepartment(dto.departmentId);
    const resolvedTitle = dto.title || dto.name || 'Untitled Position';

    return this.positionModel.create({
      ...dto,
      departmentId: deptId,
      title: resolvedTitle,
      name: resolvedTitle,
    });
  }

  async update(id: string, dto: UpdatePositionDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const payload: any = { ...dto };
    if (dto.departmentId) {
      payload.departmentId = await this.validatorService.validateDepartment(dto.departmentId);
    }
    const resolvedTitle = dto.title || dto.name;
    if (resolvedTitle) {
      payload.name = resolvedTitle;
      payload.title = resolvedTitle;
    }
    const updated = await this.positionModel
      .findByIdAndUpdate(id, { $set: payload }, { new: true })
      .populate('departmentId', 'name color code')
      .lean();
    if (!updated) throw new NotFoundException('Position not found');
    return updated;
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const res = await this.positionModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Position not found');
    return { message: 'Position deleted successfully' };
  }

  async archive(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const pos = await this.positionModel.findById(id);
    if (!pos) throw new NotFoundException('Position not found');
    pos.isArchived = !pos.isArchived;
    await pos.save();
    return pos;
  }
}
