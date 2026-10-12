import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto, AddReportCommentDto, ReviewReportDto } from './dto/report.dto';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll(query?: any) {
    const filter: any = {};
    if (query?.weekEnding) filter.weekEnding = query.weekEnding;
    if (query?.status) filter.status = query.status;
    if (query?.authorId && Types.ObjectId.isValid(query.authorId)) {
      filter.authorId = new Types.ObjectId(query.authorId);
    }
    if (query?.departmentId && Types.ObjectId.isValid(query.departmentId)) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }

    return this.reportModel
      .find(filter)
      .populate('authorId', 'name email role employeeDocId')
      .populate('departmentId', 'name color code')
      .sort({ weekEnding: -1, createdAt: -1 })
      .lean();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const report = await this.reportModel
      .findById(id)
      .populate('authorId', 'name email role employeeDocId')
      .populate('departmentId', 'name color code')
      .lean();
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async create(authorId: string, dto: CreateReportDto, files?: Express.Multer.File[]) {
    const user = await this.userModel.findById(authorId);
    const departmentId = dto.departmentId
      ? new Types.ObjectId(dto.departmentId)
      : user?.departmentId;

    const attachments = (files || []).map((file) => ({
      originalName: file.originalname,
      name: file.originalname,
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
    }));

    const weekEnding =
      dto.weekEnding ||
      dto.weekEndDate ||
      dto.weekStartDate ||
      new Date().toISOString().split('T')[0];

    const content = dto.content || dto.workedOn || '';
    const achievements = dto.achievements || dto.completed || '';
    const challenges = dto.challenges || dto.blockers || '';
    const plans = dto.plans || dto.nextWeekPlan || '';

    return this.reportModel.create({
      ...dto,
      weekEnding,
      weekStartDate: dto.weekStartDate || '',
      weekEndDate: dto.weekEndDate || weekEnding,
      content,
      workedOn: dto.workedOn || content,
      achievements,
      completed: dto.completed || achievements,
      challenges,
      blockers: dto.blockers || challenges,
      plans,
      nextWeekPlan: dto.nextWeekPlan || plans,
      authorId: new Types.ObjectId(authorId),
      departmentId,
      attachments,
      status: 'submitted',
    });
  }

  async addComment(id: string, userId: string, dto: AddReportCommentDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const user = await this.userModel.findById(userId).lean();

    const updated = await this.reportModel
      .findByIdAndUpdate(
        id,
        {
          $push: {
            comments: {
              authorId: new Types.ObjectId(userId),
              authorName: user ? user.name : 'Reviewer',
              text: dto.text,
              createdAt: new Date(),
            },
          },
        },
        { new: true },
      )
      .populate('authorId', 'name email')
      .lean();

    if (!updated) throw new NotFoundException('Report not found');
    return updated;
  }

  async review(id: string, reviewerId?: string, dto?: ReviewReportDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const status = dto?.status || 'reviewed';
    const reviewMessage = dto?.reviewMessage || dto?.reviewComments || '';
    const updatePayload: any = { status };
    if (reviewMessage) updatePayload.reviewMessage = reviewMessage;
    if (reviewerId && Types.ObjectId.isValid(reviewerId)) {
      updatePayload.reviewerId = new Types.ObjectId(reviewerId);
    }

    const updated = await this.reportModel
      .findByIdAndUpdate(id, { $set: updatePayload }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Report not found');
    return updated;
  }

  async delete(id: string, currentUser?: CurrentUserPayload) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const report = await this.reportModel.findById(id);
    if (!report) throw new NotFoundException('Report not found');

    if (
      currentUser &&
      !currentUser.isSuperAdmin &&
      currentUser.role !== 'Super Admin' &&
      report.authorId &&
      report.authorId.toString() !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'Unauthorized: You may only delete reports that you have authored.',
      );
    }

    await this.reportModel.findByIdAndDelete(id);
    return { message: 'Report deleted successfully' };
  }
}
