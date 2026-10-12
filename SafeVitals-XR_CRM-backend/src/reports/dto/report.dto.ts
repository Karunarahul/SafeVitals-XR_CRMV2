import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiPropertyOptional({ example: '2025-02-07' })
  @IsOptional()
  @IsString()
  weekEnding?: string;

  @ApiPropertyOptional({ example: '2025-02-01' })
  @IsOptional()
  @IsString()
  weekStartDate?: string;

  @ApiPropertyOptional({ example: '2025-02-07' })
  @IsOptional()
  @IsString()
  weekEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workedOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  achievements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  completed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  challenges?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  blockers?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plans?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextWeekPlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class AddReportCommentDto {
  @ApiProperty({ example: 'Great progress on the XR synchronization pipeline.' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class ReviewReportDto {
  @ApiPropertyOptional({ example: 'Approved' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Approved without changes' })
  @IsOptional()
  @IsString()
  reviewMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewComments?: string;
}
