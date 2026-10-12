import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  @IsString()
  @IsOptional()
  MONGODB_URI: string = 'mongodb://localhost:27017/safevitals_crm';

  @IsString()
  @IsOptional()
  JWT_SECRET: string = 'safevitals-dev-super-secret-key-change-in-production-min32chars';

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string = 'safevitals-dev-refresh-secret-key-change-in-production';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:3000,http://127.0.0.1:3000';

  @IsString()
  @IsOptional()
  SMTP_HOST: string = 'smtp.mailtrap.io';

  @IsNumber()
  @IsOptional()
  SMTP_PORT: number = 2525;

  @IsString()
  @IsOptional()
  SMTP_USER: string = '';

  @IsString()
  @IsOptional()
  SMTP_PASS: string = '';

  @IsString()
  @IsOptional()
  SMTP_FROM: string = '"SafeVitals XR CRM" <noreply@safevitals.com>';

  @IsString()
  @IsOptional()
  UPLOAD_DEST: string = './uploads';

  @IsString()
  @IsOptional()
  SEED_ADMIN_EMAIL: string = 'admin@safevitals.com';

  @IsString()
  @IsOptional()
  SEED_ADMIN_PASSWORD: string = 'AdminPassword123!';

  @IsString()
  @IsOptional()
  SEED_ADMIN_NAME: string = 'System Administrator';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }

  // Production Security Guards
  if (validatedConfig.NODE_ENV === Environment.Production) {
    const jwtSecret = String(config.JWT_SECRET || '');
    if (!jwtSecret || jwtSecret.includes('safevitals-dev-super-secret-key') || jwtSecret.length < 32) {
      throw new Error(
        '[SECURITY] In production, JWT_SECRET must be configured with a unique, high-entropy key of at least 32 characters.',
      );
    }
  }

  return validatedConfig;
}
