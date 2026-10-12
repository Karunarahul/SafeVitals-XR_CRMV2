import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrgSettings, OrgSettingsDocument } from './schemas/org-settings.schema';
import { UpdateOrgSettingsDto } from './dto/org-settings.dto';

@Injectable()
export class OrgSettingsService {
  constructor(
    @InjectModel(OrgSettings.name)
    private readonly orgSettingsModel: Model<OrgSettingsDocument>,
  ) {}

  async getSettings() {
    let settings = await this.orgSettingsModel.findOne().lean();
    if (!settings) {
      settings = (await this.orgSettingsModel.create({
        companyName: 'SafeVitals XR',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      })).toObject();
    }
    return settings;
  }

  async updateSettings(dto: UpdateOrgSettingsDto) {
    let settings = await this.orgSettingsModel.findOne();
    if (!settings) {
      settings = await this.orgSettingsModel.create(dto);
      return settings.toObject();
    }

    Object.assign(settings, dto);
    await settings.save();
    return settings.toObject();
  }
}
