import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { CurrentUserPayload } from '../interfaces/current-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If neither roles nor permissions are required on this endpoint, allow access
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{
      user: CurrentUserPayload;
    }>();

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Super Admin has universal access
    const userRoleLower = (user.role || '').toLowerCase().replace(/\s+/g, '');
    const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];
    const isSuper =
      user.isSuperAdmin === true ||
      userRoleLower === 'superadmin' ||
      userPermissions.includes('*.*.*');

    if (isSuper) {
      return true;
    }

    let roleMatched = false;
    if (requiredRoles && requiredRoles.length > 0) {
      roleMatched = requiredRoles.some((role) => {
        const targetRoleLower = role.toLowerCase().replace(/\s+/g, '');
        return userRoleLower === targetRoleLower;
      });
    }

    let permissionsMatched = false;
    if (requiredPermissions && requiredPermissions.length > 0) {
      // Must satisfy all required permissions (or matching wildcards like "employees.*")
      permissionsMatched = requiredPermissions.every((reqPerm) => {
        return userPermissions.some((userPerm) => {
          if (userPerm === '*.*.*') return true;
          if (userPerm === reqPerm) return true;
          const [reqMod] = reqPerm.split('.');
          if (userPerm === `${reqMod}.*`) return true;
          return false;
        });
      });
    }

    // Access granted if:
    // 1. Both defined and either role or permission matched
    // 2. Only role defined and role matched
    // 3. Only permission defined and permission matched
    if (requiredRoles && requiredRoles.length > 0 && requiredPermissions && requiredPermissions.length > 0) {
      if (roleMatched || permissionsMatched) {
        return true;
      }
    } else if (requiredRoles && requiredRoles.length > 0) {
      if (roleMatched) {
        return true;
      }
    } else if (requiredPermissions && requiredPermissions.length > 0) {
      if (permissionsMatched) {
        return true;
      }
    }

    const requiredConditions: string[] = [];
    if (requiredRoles && requiredRoles.length > 0) {
      requiredConditions.push(`role [${requiredRoles.join(', ')}]`);
    }
    if (requiredPermissions && requiredPermissions.length > 0) {
      requiredConditions.push(`permission [${requiredPermissions.join(', ')}]`);
    }

    throw new ForbiddenException(
      `Insufficient permissions: required ${requiredConditions.join(' or ')}`,
    );
  }
}

