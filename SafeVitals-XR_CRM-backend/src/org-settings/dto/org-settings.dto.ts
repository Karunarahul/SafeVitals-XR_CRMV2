import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrgSettingsDto {
  @ApiPropertyOptional({ example: 'SafeVitals XR' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional({ example: 'admin@safevitals.com' })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'SafeVitals HR' })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({ example: 'hr@safevitals.com' })
  @IsOptional()
  @IsString()
  replyToEmail?: string;

  @ApiPropertyOptional({ example: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] })
  @IsOptional()
  @IsArray()
  workingDays?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  workHours?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  leavePolicy?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attendancePolicy?: Record<string, any>;
}
