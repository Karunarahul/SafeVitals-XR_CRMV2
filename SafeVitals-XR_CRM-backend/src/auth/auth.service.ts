import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { Invitation, InvitationDocument } from '../employees/schemas/invitation.schema';
import { MailService } from '../mail/mail.service';
import {
  LoginDto,
  VerifyOtpDto,
  FirebaseLoginDto,
  RegisterDto,
  VerifyRegisterOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SetupPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Invitation.name) private readonly invitationModel: Model<InvitationDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  private generateToken(user: any, employeeId?: string, permissions: string[] = []): string {
    const payload = {
      sub: (user._id || user.id).toString(),
      email: user.email,
      role: user.role,
      roleId: user.roleId ? user.roleId.toString() : undefined,
      employeeDocId: user.employeeDocId ? user.employeeDocId.toString() : undefined,
      employeeId,
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
      teamId: user.teamId ? user.teamId.toString() : undefined,
      isSuperAdmin: !!user.isSuperAdmin,
      permissions,
    };
    return this.jwtService.sign(payload);
  }

  private async buildAuthUserResponse(user: any): Promise<{ authUser: any; employeeId?: string; permissions: string[] }> {
    const userId = (user._id || user.id).toString();
    let employeeId: string | undefined;

    if (user.employeeDocId) {
      const emp = await this.employeeModel.findById(user.employeeDocId).select('employeeId').lean();
      if (emp) employeeId = emp.employeeId;
    } else {
      const emp = await this.employeeModel.findOne({ userId }).select('employeeId').lean();
      if (emp) employeeId = emp.employeeId;
    }

    let permissions: string[] = [];
    if (user.isSuperAdmin || user.role === 'Super Admin') {
      permissions = ['*.*.*'];
    } else if (user.roleId) {
      const roleDoc = await this.roleModel.findById(user.roleId).lean();
      if (roleDoc && Array.isArray(roleDoc.permissions)) {
        permissions = roleDoc.permissions;
      }
    } else if (user.role) {
      const roleDoc = await this.roleModel.findOne({ name: user.role }).lean();
      if (roleDoc && Array.isArray(roleDoc.permissions)) {
        permissions = roleDoc.permissions;
      }
    }

    const firstName = user.firstName || (user.name ? user.name.split(' ')[0] : '');
    const lastName = user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : '');
    const fullName = user.name || `${firstName} ${lastName}`.trim();

    const authUser = {
      id: userId,
      _id: userId,
      email: user.email,
      firstName,
      lastName,
      fullName,
      status: user.status,
      role: user.role,
      roleId: user.roleId ? user.roleId.toString() : undefined,
      permissions,
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
      teamId: user.teamId ? user.teamId.toString() : undefined,
      positionId: user.positionId ? user.positionId.toString() : undefined,
      employeeDocId: user.employeeDocId ? user.employeeDocId.toString() : undefined,
      employeeId,
      avatar: user.avatar || user.avatarUrl || '',
      mustChangePassword: !!user.mustChangePassword,
    };

    return { authUser, employeeId, permissions };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email })
      .select('+password +passwordHash +otp +otpExpiresAt +otpAttempts +isTwoFactorEnabled +twoFactorEnabled');

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException('Your account is pending administrator approval');
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException(`Your account has been ${user.status.toLowerCase()}`);
    }

    const currentHash = user.password || user.passwordHash;
    if (!currentHash) {
      throw new UnauthorizedException(
        'Account password has not been established. Please activate your account via the invitation link sent to your email.',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, currentHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Two-factor authentication check
    const is2faActive = user.isTwoFactorEnabled || user.twoFactorEnabled;
    if (is2faActive) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = await bcrypt.hash(otpCode, 8);
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      user.otpAttempts = 0;
      await user.save();

      await this.mailService.sendOtpEmail(user.email, otpCode, 'Two-Factor Login');

      return {
        success: true,
        userId: user._id.toString(),
        requiresTwoFactor: true,
        email: user.email,
        message: 'OTP sent to your email!',
      };
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { authUser, employeeId, permissions } = await this.buildAuthUserResponse(user);
    const token = this.generateToken(user, employeeId, permissions);

    return {
      success: true,
      token,
      user: authUser,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  async verifyLoginOtp(dto: VerifyOtpDto) {
    let query: any = {};
    if (dto.userId) {
      query._id = dto.userId;
    } else if (dto.email) {
      query.email = dto.email.trim().toLowerCase();
    } else {
      throw new BadRequestException('User identification (userId or email) is required');
    }

    const user = await this.userModel
      .findOne(query)
      .select('+otp +otpExpiresAt +otpAttempts +passwordHash +isTwoFactorEnabled +twoFactorEnabled');

    if (!user || !user.otp || !user.otpExpiresAt) {
      throw new BadRequestException('No pending OTP request found. Please request a new code.');
    }

    if (user.otpAttempts >= 5) {
      throw new BadRequestException('Too many failed verification attempts. Please request a new code.');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    const isMatch = await bcrypt.compare(dto.otp.trim(), user.otp);
    if (!isMatch) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      throw new BadRequestException('Invalid verification code');
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    user.lastLoginAt = new Date();
    await user.save();

    const { authUser, employeeId, permissions } = await this.buildAuthUserResponse(user);
    const token = this.generateToken(user, employeeId, permissions);

    return {
      success: true,
      token,
      user: authUser,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const fullName = (dto.fullName || dto.name || '').trim();
    const phone = dto.phone ? dto.phone.trim() : '';

    const existing = await this.userModel
      .findOne({ email })
      .select('+password +passwordHash +otp +otpExpiresAt');

    if (existing) {
      if (existing.status === UserStatus.ACTIVE) {
        throw new ConflictException('An account with this email address already exists');
      }
      if (existing.status === UserStatus.PENDING && (existing.password || existing.passwordHash)) {
        throw new ConflictException(
          'An account with this email is already registered and awaiting administrator approval',
        );
      }

      // Re-initiate pending unverified registration
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(otpCode, 8);
      const registrationToken = 'reg_tok_' + crypto.randomBytes(24).toString('hex');

      existing.otp = hashedOtp;
      existing.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      existing.otpAttempts = 0;
      existing.registrationToken = registrationToken;
      existing.registrationTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      if (fullName) {
        existing.name = fullName;
        existing.firstName = fullName.split(' ')[0] || '';
        existing.lastName = fullName.split(' ').slice(1).join(' ') || '';
      }
      if (phone) existing.phone = phone;
      await existing.save();

      await this.mailService.sendOtpEmail(email, otpCode, 'Registration');

      return {
        success: true,
        registrationToken,
        message: 'Verification code sent to your email.',
      };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otpCode, 8);
    const registrationToken = 'reg_tok_' + crypto.randomBytes(24).toString('hex');

    const firstName = fullName.split(' ')[0] || '';
    const lastName = fullName.split(' ').slice(1).join(' ') || '';

    await this.userModel.create({
      name: fullName || email.split('@')[0],
      firstName,
      lastName,
      email,
      phone,
      role: 'Employee',
      status: UserStatus.PENDING,
      isEmailVerified: false,
      otp: hashedOtp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpAttempts: 0,
      registrationToken,
      registrationTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await this.mailService.sendOtpEmail(email, otpCode, 'Registration');

    return {
      success: true,
      registrationToken,
      message: 'Verification code sent to your email.',
    };
  }

  async verifyRegisterOtp(dto: VerifyRegisterOtpDto | any) {
    let user: UserDocument | null = null;

    if (dto.registrationToken) {
      user = await this.userModel
        .findOne({ registrationToken: dto.registrationToken })
        .select('+otp +otpExpiresAt +otpAttempts +registrationToken +registrationTokenExpiresAt');
    } else if (dto.email) {
      user = await this.userModel
        .findOne({ email: dto.email.trim().toLowerCase() })
        .select('+otp +otpExpiresAt +otpAttempts +registrationToken +registrationTokenExpiresAt');
    }

    if (!user || !user.otp || !user.otpExpiresAt) {
      throw new BadRequestException('Invalid or expired registration session. Please request a new code.');
    }

    if (user.registrationTokenExpiresAt && new Date() > user.registrationTokenExpiresAt) {
      throw new BadRequestException('Registration session has expired. Please register again.');
    }

    if (user.otpAttempts >= 5) {
      throw new BadRequestException('Too many failed verification attempts. Please request a new code.');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    const isMatch = await bcrypt.compare(dto.otp.trim(), user.otp);
    if (!isMatch) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      throw new BadRequestException('Invalid verification code');
    }

    if (!dto.password) {
      throw new BadRequestException('Password is required to complete registration.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    user.password = hashedPassword;
    user.passwordHash = hashedPassword;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    user.registrationToken = undefined;
    user.registrationTokenExpiresAt = undefined;
    user.isEmailVerified = true;
    user.status = UserStatus.PENDING; // Preserved as pending administrator approval
    await user.save();

    return {
      success: true,
      pendingOnboarding: true,
      message: 'Email verified! Registration complete. Your account is pending administrator approval.',
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    let query: any = {};
    if (dto.userId) {
      query._id = dto.userId;
    } else if (dto.email) {
      query.email = dto.email.trim().toLowerCase();
    } else {
      throw new BadRequestException('User identifier (userId or email) is required');
    }

    const user = await this.userModel.findOne(query).select('+otp +otpExpiresAt +otpAttempts');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = await bcrypt.hash(otpCode, 8);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    await this.mailService.sendOtpEmail(user.email, otpCode, 'Verification Code Resend');

    return {
      success: true,
      message: 'A new verification code has been dispatched to your email.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email })
      .select('+resetPasswordToken +resetPasswordTokenHash +resetPasswordExpiresAt');

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordTokenHash = hashedToken;
      user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      await this.mailService.sendPasswordResetEmail(user.email, resetToken);
    }

    // Always return success to prevent email enumeration attacks
    return {
      success: true,
      message: 'If an account exists, a password reset link has been dispatched.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = dto.token.trim();
    const newPassword = dto.password || dto.newPassword;
    if (!newPassword) {
      throw new BadRequestException('New password is required');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel
      .findOne({
        $or: [
          { resetPasswordToken: hashedToken },
          { resetPasswordTokenHash: hashedToken },
          { resetPasswordToken: token },
        ],
        resetPasswordExpiresAt: { $gt: new Date() },
      })
      .select('+password +passwordHash +resetPasswordToken +resetPasswordTokenHash +resetPasswordExpiresAt');

    if (!user) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordHash = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    user.mustChangePassword = false;
    await user.save();

    return {
      success: true,
      message: 'Password has been successfully reset. You may now log in.',
    };
  }

  async setupPassword(dto: SetupPasswordDto) {
    const rawToken = (dto.invitationToken || dto.token || '').trim();
    if (!rawToken) {
      throw new BadRequestException('Invitation token is required');
    }
    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    // 1. Try finding in Invitation collection
    const invitation = await this.invitationModel.findOne({
      token: rawToken,
      status: { $in: ['Pending', 'Sent'] },
      expiresAt: { $gt: new Date() },
    });

    if (invitation) {
      let user = await this.userModel.findOne({ email: invitation.email.toLowerCase() }).select('+password +passwordHash');
      if (!user && invitation.employeeId) {
        const emp = await this.employeeModel.findById(invitation.employeeId);
        if (emp?.userId) {
          user = await this.userModel.findById(emp.userId).select('+password +passwordHash');
        }
      }

      if (!user) {
        throw new BadRequestException('Account associated with invitation could not be found');
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);
      user.password = hashedPassword;
      user.passwordHash = hashedPassword;
      user.status = UserStatus.ACTIVE;
      user.mustChangePassword = false;
      user.isEmailVerified = true;
      await user.save();

      if (invitation.employeeId) {
        await this.employeeModel.findByIdAndUpdate(invitation.employeeId, { status: 'Active' });
      } else if (user.employeeDocId) {
        await this.employeeModel.findByIdAndUpdate(user.employeeDocId, { status: 'Active' });
      }

      invitation.status = 'Activated';
      await invitation.save();

      const { authUser, employeeId, permissions } = await this.buildAuthUserResponse(user);
      const token = this.generateToken(user, employeeId, permissions);

      return {
        success: true,
        message: 'Account successfully activated.',
        token,
        user: authUser,
      };
    }

    // 2. Fallback to User.activationToken
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const user = await this.userModel
      .findOne({
        $or: [
          { activationToken: hashedToken },
          { activationToken: rawToken },
        ],
        activationTokenExpiresAt: { $gt: new Date() },
      })
      .select('+password +passwordHash +activationToken +activationTokenExpiresAt');

    if (!user) {
      throw new BadRequestException('Activation token is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    user.password = hashedPassword;
    user.passwordHash = hashedPassword;
    user.status = UserStatus.ACTIVE;
    user.activationToken = undefined;
    user.activationTokenExpiresAt = undefined;
    user.mustChangePassword = false;
    user.isEmailVerified = true;
    await user.save();

    if (user.employeeDocId) {
      await this.employeeModel.findByIdAndUpdate(user.employeeDocId, { status: 'Active' });
    }

    const { authUser, employeeId, permissions } = await this.buildAuthUserResponse(user);
    const token = this.generateToken(user, employeeId, permissions);

    return {
      success: true,
      message: 'Account successfully activated.',
      token,
      user: authUser,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+password +passwordHash');
    if (!user || (!user.password && !user.passwordHash)) {
      throw new BadRequestException('Unable to change password. Account has no established password.');
    }

    const currentHash = user.password || user.passwordHash;
    const isMatch = await bcrypt.compare(dto.currentPassword, currentHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    user.password = hashedPassword;
    user.passwordHash = hashedPassword;
    user.mustChangePassword = false;
    await user.save();

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { authUser } = await this.buildAuthUserResponse(user);
    return {
      success: true,
      user: authUser,
    };
  }

  async firebaseLogin(dto: FirebaseLoginDto) {
    const email = dto.email ? dto.email.trim().toLowerCase() : '';
    let user: UserDocument | null = null;

    if (dto.uid) {
      user = await this.userModel.findOne({ firebaseUid: dto.uid });
    }
    if (!user && email) {
      user = await this.userModel.findOne({ email });
    }

    if (!user) {
      const name = dto.name || (email ? email.split('@')[0] : 'User');
      user = await this.userModel.create({
        email: email || `${dto.uid}@firebase.user`,
        name,
        firstName: name.split(' ')[0] || '',
        lastName: name.split(' ').slice(1).join(' ') || '',
        role: 'Employee',
        status: UserStatus.PENDING,
        firebaseUid: dto.uid,
        isEmailVerified: true,
      });

      return {
        success: false,
        pendingOnboarding: true,
        firebaseUid: dto.uid,
        email: user.email,
        message: 'Your account is awaiting administrative approval.',
      };
    }

    if (dto.uid && !user.firebaseUid) {
      user.firebaseUid = dto.uid;
      await user.save();
    }

    if (user.status === UserStatus.PENDING) {
      return {
        success: false,
        pendingOnboarding: true,
        firebaseUid: user.firebaseUid,
        email: user.email,
        message: 'Your account is awaiting administrative approval.',
      };
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException(`Account is ${user.status.toLowerCase()}`);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { authUser, employeeId, permissions } = await this.buildAuthUserResponse(user);
    const token = this.generateToken(user, employeeId, permissions);

    return {
      success: true,
      token,
      firebaseUid: user.firebaseUid,
      email: user.email,
      user: authUser,
    };
  }
}
