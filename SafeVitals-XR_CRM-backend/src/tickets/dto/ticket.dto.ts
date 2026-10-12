import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiPropertyOptional({ example: 'VPN Access issue on XR headset' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'VPN Access issue on XR headset' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Cannot authenticate VPN client on Meta Quest 3' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    enum: ['hardware', 'software', 'access', 'hr', 'other', 'IT Support', 'HR', 'Facilities', 'XR Hardware', 'Other'],
    default: 'software',
  })
  @IsOptional()
  @IsEnum(['hardware', 'software', 'access', 'hr', 'other', 'IT Support', 'HR', 'Facilities', 'XR Hardware', 'Other'])
  category?: string;

  @ApiPropertyOptional({
    enum: ['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'],
    default: 'medium',
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'])
  priority?: string;
}

export class AddTicketMessageDto {
  @ApiProperty({ example: 'We have updated your security group. Please retry now.' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class AssignTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  assigneeId: string;
}

export class UpdateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ['hardware', 'software', 'access', 'hr', 'other', 'IT Support', 'HR', 'Facilities', 'XR Hardware', 'Other'],
  })
  @IsOptional()
  @IsEnum(['hardware', 'software', 'access', 'hr', 'other', 'IT Support', 'HR', 'Facilities', 'XR Hardware', 'Other'])
  category?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'resolved', 'closed'] })
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;
}
