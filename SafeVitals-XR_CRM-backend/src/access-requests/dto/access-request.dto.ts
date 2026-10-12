import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccessRequestDto {
  @ApiPropertyOptional({ example: 'role_change' })
  @IsOptional()
  @IsString()
  requestType?: string;

  @ApiPropertyOptional({ example: 'Production Database Access' })
  @IsOptional()
  @IsString()
  requestedSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetRoleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetDepartmentId?: string;

  @ApiProperty({ example: 'Promoted to lead engineer role' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RejectAccessRequestDto {
  @ApiPropertyOptional({ example: 'Requires management review' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @ApiPropertyOptional({ example: 'Requires management review' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewAccessRequestDto {
  @ApiProperty({ example: 'Approved' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({ example: 'Access granted by security administrator' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Access granted by security administrator' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

