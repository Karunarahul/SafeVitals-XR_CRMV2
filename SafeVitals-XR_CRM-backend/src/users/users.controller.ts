import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  ApproveCandidateDto,
  RejectCandidateDto,
  UpdateUserDto,
} from './dto/users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'List all registered users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('pending')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.create')
  @ApiOperation({ summary: 'List candidates awaiting approval' })
  findPending() {
    return this.usersService.findPending();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post(':id/approve')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve candidate registration and assign roles/departments' })
  approveCandidate(
    @Param('id') id: string,
    @Body() dto: ApproveCandidateDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.approveCandidate(id, dto, currentUser);
  }

  @Post(':id/reject')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject candidate registration' })
  rejectCandidate(
    @Param('id') id: string,
    @Body() dto: RejectCandidateDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.rejectCandidate(id, dto, currentUser);
  }

  @Put(':id')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('employees.edit')
  @ApiOperation({ summary: 'Update user attributes' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @RequirePermissions('employees.suspend')
  @ApiOperation({ summary: 'Deactivate user' })
  delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.delete(id, currentUser);
  }
}

