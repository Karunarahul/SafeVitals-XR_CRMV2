import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@safevitals.com', description: 'User work email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'AdminPassword123!', description: 'User account password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyOtpDto {
  @ApiPropertyOptional({
    example: '660c1f2e4b8d9a0012f34567',
    description: 'MongoDB User ID returned during 2FA initiation',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: 'admin@safevitals.com',
    description: 'User email (optional fallback)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class FirebaseLoginDto {
  @ApiPropertyOptional({ description: 'Firebase Auth ID token string' })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Firebase UID' })
  @IsOptional()
  @IsString()
  uid?: string;
}

export class RegisterDto {
  @ApiPropertyOptional({ example: 'Ravi Kumar', description: 'Full name of candidate' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Ravi Kumar', description: 'Alias for fullName' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'candidate@example.com', description: 'Work or personal email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Password123!', description: 'Optional initial password' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class VerifyRegisterOtpDto {
  @ApiProperty({
    example: 'reg_tok_9f8e7d6c5b4a3...',
    description: 'Cryptographically generated registration session token',
  })
  @IsString()
  @IsNotEmpty()
  registrationToken: string;

  @ApiProperty({ example: '654321', description: '6-digit registration OTP' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'Permanent account password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;
}

export class ResendOtpDto {
  @ApiPropertyOptional({
    example: '660c1f2e4b8d9a0012f34567',
    description: 'User ID for 2FA or registration OTP resend',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'User email for OTP resend fallback',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'employee@safevitals.com', description: 'Registered email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a1b2c3d4e5...',
    description: 'Cryptographic reset token dispatched to user email',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({
    example: 'NewSecurePassword123!',
    description: 'New password (min 8 characters)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    example: 'NewSecurePassword123!',
    description: 'Alias for password (min 8 characters)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}

export class SetupPasswordDto {
  @ApiPropertyOptional({
    example: 'invite_tok_123...',
    description: 'Invitation token from onboarding invite email',
  })
  @IsOptional()
  @IsString()
  invitationToken?: string;

  @ApiPropertyOptional({
    example: 'invite_tok_123...',
    description: 'Alias for invitationToken',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiProperty({
    example: 'ActivatedPassword123!',
    description: 'Permanent password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current valid password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: 'BrandNewSecurePassword123!',
    description: 'New password (min 8 characters, must differ from current)',
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword: string;
}
