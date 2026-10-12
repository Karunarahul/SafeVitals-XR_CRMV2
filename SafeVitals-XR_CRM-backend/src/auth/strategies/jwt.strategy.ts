import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserStatus } from '../../users/schemas/user.schema';
import { Role, RoleDocument } from '../../roles/schemas/role.schema';
import { CurrentUserPayload } from '../../common/interfaces/current-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: any): Promise<CurrentUserPayload> {
    const user = await this.userModel.findById(payload.sub).lean();
    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    const isSuperAdmin =
      !!user.isSuperAdmin ||
      user.role === 'Super Admin' ||
      !!payload.isSuperAdmin;

    let permissions: string[] = payload.permissions || [];
    if (isSuperAdmin) {
      permissions = ['*.*.*'];
    } else if (!permissions || permissions.length === 0) {
      if (user.roleId) {
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
    }

    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeDocId: user.employeeDocId ? user.employeeDocId.toString() : undefined,
      employeeId: payload.employeeId,
      isSuperAdmin,
      permissions,
      roleId: user.roleId ? user.roleId.toString() : payload.roleId,
    };
  }
}

