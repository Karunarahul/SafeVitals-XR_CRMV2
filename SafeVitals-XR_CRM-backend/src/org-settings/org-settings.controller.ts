import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrgSettingsService } from './org-settings.service';
import { UpdateOrgSettingsDto } from './dto/org-settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Organization Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['organization', 'org-settings'])
export class OrgSettingsController {
  constructor(private readonly orgSettingsService: OrgSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get global organization configuration' })
  getSettings() {
    return this.orgSettingsService.getSettings();
  }

  @Put()
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Update global organization configuration' })
  updateSettings(@Body() dto: UpdateOrgSettingsDto) {
    return this.orgSettingsService.updateSettings(dto);
  }
}
