import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, RejectLeaveDto, ReviewLeaveDto } from './dto/leave.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('my')
  @ApiOperation({ summary: "List current employee's leaves" })
  findMyLeaves(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.leaveService.findMyLeaves(currentUser);
  }

  @Get('balance')
  @ApiOperation({ summary: "Get current employee's annual leave balance" })
  getLeaveBalance(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.leaveService.getLeaveBalance(currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'List all leave applications with filters' })
  findAll(@Query() query: any) {
    return this.leaveService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific leave request details' })
  findById(@Param('id') id: string) {
    return this.leaveService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new leave application' })
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreateLeaveDto,
  ) {
    return this.leaveService.create(currentUser, dto);
  }

  @Post(':id/approve')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve leave request' })
  approve(
    @Param('id') id: string,
    @CurrentUser('userId') reviewerId: string,
  ) {
    return this.leaveService.approve(id, reviewerId);
  }

  @Post(':id/reject')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject leave request' })
  reject(
    @Param('id') id: string,
    @CurrentUser('userId') reviewerId: string,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveService.reject(id, reviewerId, dto);
  }

  @Patch(':id/review')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review leave request (Approve or Reject)' })
  review(
    @Param('id') id: string,
    @CurrentUser('userId') reviewerId: string,
    @Body() dto: ReviewLeaveDto,
  ) {
    const status = (dto.status || '').toLowerCase();
    if (status === 'approved') {
      return this.leaveService.approve(id, reviewerId);
    } else {
      return this.leaveService.reject(id, reviewerId, {
        reason: dto.note || dto.reviewNotes || 'Rejected by reviewer',
      });
    }
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel pending leave request' })
  cancel(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveService.cancel(id, currentUser);
  }
}
