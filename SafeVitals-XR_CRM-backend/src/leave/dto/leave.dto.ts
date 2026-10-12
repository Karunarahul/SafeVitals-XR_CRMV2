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
  @ApiProperty({ enum: ['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid'] })
  @IsEnum(['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid'])
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '2025-02-01' })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2025-02-05' })
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @Min(0.5)
  days: number;

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
