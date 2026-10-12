import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  CheckInDto,
  CheckOutDto,
  ManualAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('me/today')
  @ApiOperation({ summary: "Get current user's today attendance status" })
  getMyToday(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.attendanceService.getMyToday(currentUser);
  }

  @Get('today-summary')
  @ApiOperation({ summary: 'Get aggregate counts for today attendance' })
  getTodaySummary() {
    return this.attendanceService.getTodaySummary();
  }

  @Get()
  @ApiOperation({ summary: 'List attendance records with filters' })
  findAll(@Query() query: any) {
    return this.attendanceService.findAll(query);
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee check-in for the day' })
  checkIn(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(currentUser, dto);
  }

  @Post('break-start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start break period' })
  startBreak(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.attendanceService.startBreak(currentUser);
  }

  @Post('break-end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End break period and calculate duration' })
  endBreak(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.attendanceService.endBreak(currentUser);
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee check-out for the day' })
  checkOut(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(currentUser, dto);
  }

  @Post()
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Manual attendance log entry' })
  createManual(@Body() dto: ManualAttendanceDto) {
    return this.attendanceService.createManual(dto);
  }

  @Put(':id')
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Update attendance record' })
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, dto);
  }
}
