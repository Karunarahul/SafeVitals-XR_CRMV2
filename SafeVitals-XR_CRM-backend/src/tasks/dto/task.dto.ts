import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement WebSocket Attendance Alerts' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ enum: ['todo', 'in_progress', 'review', 'done', 'To Do', 'In Progress', 'Blocked', 'Done', 'Cancelled'], default: 'todo' })
  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'review', 'done', 'To Do', 'In Progress', 'Blocked', 'Done', 'Cancelled'])
  status?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'], default: 'medium' })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'])
  priority?: string;

  @ApiPropertyOptional({ example: '2025-02-15' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ enum: ['todo', 'in_progress', 'review', 'done', 'To Do', 'In Progress', 'Blocked', 'Done', 'Cancelled'] })
  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'review', 'done', 'To Do', 'In Progress', 'Blocked', 'Done', 'Cancelled'])
  status?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent', 'Low', 'Medium', 'High', 'Urgent'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ['todo', 'in_progress', 'review', 'done', 'To Do', 'In Progress', 'Blocked', 'Done', 'Cancelled'] })
  @IsEnum(['todo', 'in_progress', 'review', 'done', 'To Do', 'In Progress', 'Blocked', 'Done', 'Cancelled'])
  @IsNotEmpty()
  status: string;
}
