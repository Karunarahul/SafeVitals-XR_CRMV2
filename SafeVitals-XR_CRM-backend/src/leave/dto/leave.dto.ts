import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveDto {
  @ApiPropertyOptional({ enum: ['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid', 'Annual', 'Sick', 'Casual', 'Earned', 'Unpaid'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leaveType?: string;

  @ApiProperty({ example: '2025-02-01' })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2025-02-05' })
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class RejectLeaveDto {
  @ApiProperty({ example: 'Department understaffed during project launch' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReviewLeaveDto {
  @ApiProperty({ example: 'Approved' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({ example: 'Approved by manager' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Approved by manager' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
