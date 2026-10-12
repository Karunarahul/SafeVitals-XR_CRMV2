import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { CreateAuditLogDto } from './dto/audit.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.module) filter.module = query.module;
    if (query?.action) filter.action = query.action;
    if (query?.userId && Types.ObjectId.isValid(query.userId)) {
      filter.userId = new Types.ObjectId(query.userId);
    }
    if (query?.startDate && query?.endDate) {
      filter.createdAt = {
        $gte: new Date(query.startDate),
        $lte: new Date(query.endDate),
      };
    }

    return this.auditModel
      .find(filter)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  async log(user?: CurrentUserPayload | null, dto?: CreateAuditLogDto, ipAddress = '') {
    return this.auditModel.create({
      userId: user?.userId && Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined,
      userName: user?.email || 'System',
      action: dto?.action || 'UNKNOWN',
      module: dto?.module || 'General',
      targetId: dto?.targetId || '',
      details: dto?.details || {},
      ipAddress,
    });
  }
}
