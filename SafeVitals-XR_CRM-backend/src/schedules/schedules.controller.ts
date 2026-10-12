import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import {
  CreateScheduleDto,
  BulkCreateScheduleDto,
  UpdateScheduleDto,
} from './dto/schedule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('my')
  @ApiOperation({ summary: "Get current employee's shift schedules" })
  findMySchedule(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: any,
  ) {
    return this.schedulesService.findMySchedule(currentUser, query);
  }

  @Get()
  @ApiOperation({ summary: 'List all employee schedules with filters' })
  findAll(@Query() query: any) {
    return this.schedulesService.findAll(query);
  }

  @Post()
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Assign schedule to employee' })
  create(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(dto);
  }

  @Post('bulk')
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Bulk assign schedules to employees' })
  bulkCreate(@Body() dto: BulkCreateScheduleDto) {
    return this.schedulesService.bulkCreate(dto);
  }

  @Put(':id')
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Update schedule entry' })
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedulesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Delete schedule entry' })
  delete(@Param('id') id: string) {
    return this.schedulesService.delete(id);
  }
}
