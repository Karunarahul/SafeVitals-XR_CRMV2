import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  OnboardUidDto,
} from './dto/employees.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'List all employees with optional filters' })
  findAll(@Query() query: any) {
    return this.employeesService.findAll(query);
  }

  @Post('onboard-uid')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Onboard employee with Firebase UID' })
  onboardUid(
    @Body() dto: OnboardUidDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.employeesService.onboardUid(dto, currentUser);
  }

  @Get(':id')
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Get employee details by Mongo ID or sequential EMP ID' })
  findById(@Param('id') id: string) {
    return this.employeesService.findByIdOrEmployeeId(id);
  }

  @Post()
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.create')
  @ApiOperation({ summary: 'Create and invite a new employee' })
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.employeesService.create(dto, currentUser);
  }

  @Put(':id')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.edit')
  @ApiOperation({ summary: 'Update employee details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.employeesService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @RequirePermissions('employees.suspend')
  @ApiOperation({ summary: 'Delete employee record' })
  delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.employeesService.delete(id, currentUser);
  }

  @Patch(':id/suspend')
  @Post(':id/suspend')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend employee and login access' })
  suspend(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.employeesService.suspend(id, currentUser);
  }

  @Patch(':id/reactivate')
  @Post(':id/reactivate')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate suspended employee' })
  reactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.employeesService.reactivate(id, currentUser);
  }

  @Patch(':id/deactivate')
  @Post(':id/deactivate')
  @Roles('Super Admin')
  @RequirePermissions('employees.suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate employee permanently' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.employeesService.deactivate(id, currentUser);
  }
}

