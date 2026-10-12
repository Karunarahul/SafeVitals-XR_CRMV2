import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from './schemas/ticket.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SequenceService } from '../database/sequence.service';
import {
  CreateTicketDto,
  AddTicketMessageDto,
  AssignTicketDto,
  UpdateTicketDto,
} from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly sequenceService: SequenceService,
  ) {}

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.status) filter.status = query.status;
    if (query?.priority) filter.priority = query.priority;
    if (query?.category) filter.category = query.category;
    if (query?.creatorId && Types.ObjectId.isValid(query.creatorId)) {
      filter.creatorId = new Types.ObjectId(query.creatorId);
    }
    if (query?.assigneeId && Types.ObjectId.isValid(query.assigneeId)) {
      filter.assigneeId = new Types.ObjectId(query.assigneeId);
    }

    return this.ticketModel
      .find(filter)
      .populate('creatorId', 'name email role')
      .populate('assigneeId', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id: string) {
    let ticket: any = null;
    if (Types.ObjectId.isValid(id)) {
      ticket = await this.ticketModel
        .findById(id)
        .populate('creatorId', 'name email role')
        .populate('assigneeId', 'name email role')
        .lean();
    }
    if (!ticket) {
      ticket = await this.ticketModel
        .findOne({ ticketNumber: id })
        .populate('creatorId', 'name email role')
        .populate('assigneeId', 'name email role')
        .lean();
    }
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async create(creatorId: string, dto: CreateTicketDto) {
    const ticketNumber = await this.sequenceService.getNextSequence(
      'ticketNumber',
      'TICK-',
      4,
    );

    return this.ticketModel.create({
      ...dto,
      ticketNumber,
      creatorId: new Types.ObjectId(creatorId),
      status: 'open',
      messages: [],
    });
  }

  async addMessage(id: string, userId: string, dto: AddTicketMessageDto) {
    const ticket = await this.findById(id);
    const user = await this.userModel.findById(userId).lean();

    const updated = await this.ticketModel
      .findByIdAndUpdate(
        ticket._id,
        {
          $push: {
            messages: {
              senderId: new Types.ObjectId(userId),
              senderName: user ? user.name : 'Support Agent',
              message: dto.message,
              createdAt: new Date(),
            },
          },
          ...(ticket.status === 'open' ? { status: 'in_progress' } : {}),
        },
        { new: true },
      )
      .populate('creatorId', 'name email')
      .populate('assigneeId', 'name email')
      .lean();

    return updated;
  }

  async assign(id: string, dto: AssignTicketDto) {
    if (!Types.ObjectId.isValid(dto.assigneeId)) {
      throw new BadRequestException('Invalid assignee ID format');
    }
    const ticket = await this.findById(id);
    const updated = await this.ticketModel
      .findByIdAndUpdate(
        ticket._id,
        {
          $set: {
            assigneeId: new Types.ObjectId(dto.assigneeId),
            status: ticket.status === 'open' ? 'in_progress' : ticket.status,
          },
        },
        { new: true },
      )
      .populate('creatorId', 'name email')
      .populate('assigneeId', 'name email')
      .lean();

    return updated;
  }

  async resolve(id: string) {
    const ticket = await this.findById(id);
    const updated = await this.ticketModel
      .findByIdAndUpdate(ticket._id, { $set: { status: 'resolved' } }, { new: true })
      .lean();
    return updated;
  }

  async close(id: string) {
    const ticket = await this.findById(id);
    const updated = await this.ticketModel
      .findByIdAndUpdate(ticket._id, { $set: { status: 'closed' } }, { new: true })
      .lean();
    return updated;
  }

  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.findById(id);
    const payload: any = { ...dto };
    if (dto.assigneeId && Types.ObjectId.isValid(dto.assigneeId)) {
      payload.assigneeId = new Types.ObjectId(dto.assigneeId);
    }
    const updated = await this.ticketModel
      .findByIdAndUpdate(ticket._id, { $set: payload }, { new: true })
      .lean();
    return updated;
  }

  async delete(id: string) {
    const ticket = await this.findById(id);
    await this.ticketModel.findByIdAndDelete(ticket._id);
    return { message: 'Ticket deleted successfully' };
  }
}
