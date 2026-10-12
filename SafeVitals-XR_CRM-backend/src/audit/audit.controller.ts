import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { CreateAuditLogDto } from './dto/audit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['audit', 'audit-logs'])
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('Super Admin', 'Admin', 'Manager')
  @RequirePermissions('audit.view')
  @ApiOperation({ summary: 'List system compliance and audit trails' })
  findAll(@Query() query: any) {
    return this.auditService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Record audit log event' })
  log(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAuditLogDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '';
    return this.auditService.log(user, dto, ip);
  }
}

