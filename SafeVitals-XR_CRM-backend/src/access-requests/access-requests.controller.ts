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
import { AccessRequestsService } from './access-requests.service';
import {
  CreateAccessRequestDto,
  RejectAccessRequestDto,
  ReviewAccessRequestDto,
} from './dto/access-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../common/interfaces/current-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('Access Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly accessRequestsService: AccessRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List all access elevation requests' })
  findAll(@Query() query: any) {
    return this.accessRequestsService.findAll(query);
  }

  @Post()
  @RequirePermissions('access.request')
  @ApiOperation({ summary: 'Submit an access change request' })
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreateAccessRequestDto,
  ) {
    return this.accessRequestsService.create(currentUser, dto);
  }

  @Patch(':id/review')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('access.review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review access request (Approve or Reject)' })
  review(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: ReviewAccessRequestDto,
  ) {
    return this.accessRequestsService.review(id, currentUser, dto);
  }

  @Post(':id/approve')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('access.review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve access request and apply privileges' })
  approve(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.accessRequestsService.approve(id, currentUser.userId, currentUser);
  }

  @Post(':id/reject')
  @Roles('Super Admin', 'Manager')
  @RequirePermissions('access.review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject access request' })
  reject(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: RejectAccessRequestDto,
  ) {
    return this.accessRequestsService.reject(id, currentUser.userId, dto, currentUser);
  }
}

