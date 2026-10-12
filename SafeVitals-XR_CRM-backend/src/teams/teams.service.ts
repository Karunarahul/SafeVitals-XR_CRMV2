import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { ReferenceValidatorService } from '../database/reference-validator.service';

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,
    private readonly validatorService: ReferenceValidatorService,
  ) {}

  async findAll(departmentId?: string) {
    const filter: any = {};
    if (departmentId && Types.ObjectId.isValid(departmentId)) {
      filter.departmentId = new Types.ObjectId(departmentId);
    }
    return this.teamModel
      .find(filter)
      .populate('departmentId', 'name color code')
      .populate('leaderId', 'name email employeeId')
      .lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const team = await this.teamModel
      .findById(id)
      .populate('departmentId', 'name color code')
      .populate('leaderId', 'name email employeeId')
      .lean();
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async create(dto: CreateTeamDto) {
    // Validate parent department exists
    const deptId = await this.validatorService.validateDepartment(dto.departmentId);

    const payload: any = {
      ...dto,
      departmentId: deptId,
    };
    if (dto.leaderId && Types.ObjectId.isValid(dto.leaderId)) {
      payload.leaderId = new Types.ObjectId(dto.leaderId);
    }
    return this.teamModel.create(payload);
  }

  async update(id: string, dto: UpdateTeamDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');

    const payload: any = { ...dto };
    if (dto.departmentId) {
      payload.departmentId = await this.validatorService.validateDepartment(dto.departmentId);
    }
    if (dto.leaderId && Types.ObjectId.isValid(dto.leaderId)) {
      payload.leaderId = new Types.ObjectId(dto.leaderId);
    }

    const updated = await this.teamModel
      .findByIdAndUpdate(id, { $set: payload }, { new: true })
      .populate('departmentId', 'name color code')
      .populate('leaderId', 'name email employeeId')
      .lean();
    if (!updated) throw new NotFoundException('Team not found');
    return updated;
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const res = await this.teamModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Team not found');
    return { message: 'Team deleted successfully' };
  }

  async archive(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const team = await this.teamModel.findById(id);
    if (!team) throw new NotFoundException('Team not found');
    team.isArchived = !team.isArchived;
    await team.save();
    return team;
  }
}
