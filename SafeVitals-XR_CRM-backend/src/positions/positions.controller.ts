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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all positions, optionally filtered by department' })
  findAll(@Query('departmentId') departmentId?: string) {
    return this.positionsService.findAll(departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get position details' })
  findById(@Param('id') id: string) {
    return this.positionsService.findById(id);
  }

  @Post()
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Create position' })
  create(@Body() dto: CreatePositionDto) {
    return this.positionsService.create(dto);
  }

  @Put(':id')
  @Roles('Super Admin', 'Manager')
  @ApiOperation({ summary: 'Update position (supports EditPositionDialog)' })
  update(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.positionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Delete position' })
  delete(@Param('id') id: string) {
    return this.positionsService.delete(id);
  }

  @Post(':id/archive')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle position archive status' })
  archive(@Param('id') id: string) {
    return this.positionsService.archive(id);
  }
}
