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
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  AddTicketMessageDto,
  AssignTicketDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tickets with filters' })
  findAll(@Query() query: any) {
    return this.ticketsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details and message thread' })
  findById(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new support ticket' })
  create(
    @CurrentUser('userId') creatorId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(creatorId, dto);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Reply to support ticket thread' })
  addMessage(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: AddTicketMessageDto,
  ) {
    return this.ticketsService.addMessage(id, userId, dto);
  }

  @Post(':id/assign')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign ticket to an agent' })
  assign(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.ticketsService.assign(id, dto);
  }

  @Post(':id/resolve')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark ticket as resolved' })
  resolve(@Param('id') id: string) {
    return this.ticketsService.resolve(id);
  }

  @Post(':id/close')
  @Roles('Super Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close support ticket' })
  close(@Param('id') id: string) {
    return this.ticketsService.close(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update ticket attributes' })
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Delete ticket' })
  delete(@Param('id') id: string) {
    return this.ticketsService.delete(id);
  }
}
