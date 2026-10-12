import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async findForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid User ID');
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async markAsRead(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const notif = await this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: { isRead: true } },
      { new: true },
    );
    if (!notif) throw new NotFoundException('Notification not found');
    return notif;
  }

  async markAllAsRead(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid User ID');
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } },
    );
    return { message: 'All notifications marked as read' };
  }

  async createNotification(userId: string, title: string, message: string, type = 'info', link = '') {
    return this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      title,
      message,
      type,
      link,
      isRead: false,
    });
  }
}
