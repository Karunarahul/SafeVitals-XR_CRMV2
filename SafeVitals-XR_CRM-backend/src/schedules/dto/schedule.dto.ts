import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: '2025-02-01' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  shiftStart?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  shiftEnd?: string;

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
