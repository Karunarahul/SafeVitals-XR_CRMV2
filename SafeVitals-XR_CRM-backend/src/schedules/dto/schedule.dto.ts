import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiPropertyOptional({ example: 'Standard Day Shift' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: '2025-02-01' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  shiftStart?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  shiftEnd?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ example: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] })
  @IsOptional()
  @IsArray()
  workDays?: string[];

  @ApiPropertyOptional({ enum: ['work', 'off', 'holiday', 'on_call'], default: 'work' })
  @IsOptional()
  @IsEnum(['work', 'off', 'holiday', 'on_call'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkCreateScheduleDto {
  @ApiProperty({ type: [CreateScheduleDto] })
  @IsArray()
  schedules: CreateScheduleDto[];
}

export class UpdateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shiftStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shiftEnd?: string;

  @ApiPropertyOptional({ enum: ['work', 'off', 'holiday', 'on_call'] })
  @IsOptional()
  @IsEnum(['work', 'off', 'holiday', 'on_call'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
