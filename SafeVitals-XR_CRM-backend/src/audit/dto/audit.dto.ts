import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditLogDto {
  @ApiProperty({ example: 'USER_LOGIN' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ example: 'Auth' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  details?: Record<string, any>;
}
