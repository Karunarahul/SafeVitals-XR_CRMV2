import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrgSettingsController } from './org-settings.controller';
import { OrgSettingsService } from './org-settings.service';
import { OrgSettings, OrgSettingsSchema } from './schemas/org-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrgSettings.name, schema: OrgSettingsSchema },
    ]),
  ],
  controllers: [OrgSettingsController],
  providers: [OrgSettingsService],
  exports: [OrgSettingsService],
})
export class OrgSettingsModule {}
