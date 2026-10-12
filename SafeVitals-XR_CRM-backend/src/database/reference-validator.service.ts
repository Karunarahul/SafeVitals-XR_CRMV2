import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

@Injectable()
export class ReferenceValidatorService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private toObjectId(id: string | Types.ObjectId, fieldName: string): Types.ObjectId {
    if (!id) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    if (typeof id === 'string') {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid ObjectId format for ${fieldName}: ${id}`);
      }
      return new Types.ObjectId(id);
    }
    return id;
  }

  async validateDepartment(departmentId?: string | Types.ObjectId): Promise<Types.ObjectId | null> {
    if (!departmentId) return null;
    const objId = this.toObjectId(departmentId, 'departmentId');
    const dept = await this.connection.collection('departments').findOne({ _id: objId });
    if (!dept) {
      throw new NotFoundException(`Department with ID '${objId}' does not exist`);
    }
    if (dept.isArchived) {
      throw new BadRequestException(`Department '${dept.name}' is archived and cannot receive new assignments`);
    }
    return objId;
  }

  async validateTeam(
    teamId?: string | Types.ObjectId,
    expectedDepartmentId?: string | Types.ObjectId,
  ): Promise<Types.ObjectId | null> {
    if (!teamId) return null;
    const objId = this.toObjectId(teamId, 'teamId');
    const team = await this.connection.collection('teams').findOne({ _id: objId });
    if (!team) {
      throw new NotFoundException(`Team with ID '${objId}' does not exist`);
    }
    if (team.isArchived) {
      throw new BadRequestException(`Team '${team.name}' is archived and cannot receive new assignments`);
    }

    if (expectedDepartmentId) {
      const deptObjId = this.toObjectId(expectedDepartmentId, 'departmentId');
      if (team.departmentId.toString() !== deptObjId.toString()) {
        throw new BadRequestException(
          `Team '${team.name}' does not belong to the specified Department '${deptObjId}'`,
        );
      }
    }
    return objId;
  }

  async validatePosition(
    positionId?: string | Types.ObjectId,
    expectedDepartmentId?: string | Types.ObjectId,
  ): Promise<Types.ObjectId | null> {
    if (!positionId) return null;
    const objId = this.toObjectId(positionId, 'positionId');
    const pos = await this.connection.collection('positions').findOne({ _id: objId });
    if (!pos) {
      throw new NotFoundException(`Position with ID '${objId}' does not exist`);
    }
    if (pos.isArchived) {
      throw new BadRequestException(`Position '${pos.title || pos.name}' is archived`);
    }

    if (expectedDepartmentId) {
      const deptObjId = this.toObjectId(expectedDepartmentId, 'departmentId');
      if (pos.departmentId.toString() !== deptObjId.toString()) {
        throw new BadRequestException(
          `Position '${pos.title || pos.name}' does not belong to the specified Department '${deptObjId}'`,
        );
      }
    }
    return objId;
  }

  async validateRole(roleId?: string | Types.ObjectId): Promise<{ id: Types.ObjectId; name: string } | null> {
    if (!roleId) return null;
    const objId = this.toObjectId(roleId, 'roleId');
    const role = await this.connection.collection('roles').findOne({ _id: objId });
    if (!role) {
      throw new NotFoundException(`Role with ID '${objId}' does not exist`);
    }
    return { id: objId, name: role.name };
  }

  async validateEmployee(employeeId?: string | Types.ObjectId): Promise<Types.ObjectId | null> {
    if (!employeeId) return null;
    let objId: Types.ObjectId | null = null;

    if (Types.ObjectId.isValid(employeeId.toString())) {
      objId = new Types.ObjectId(employeeId.toString());
      const emp = await this.connection.collection('employees').findOne({ _id: objId });
      if (emp) return objId;
    }

    // Try finding by sequential employeeId (e.g. EMP-000001)
    const empByCode = await this.connection.collection('employees').findOne({ employeeId: employeeId.toString() });
    if (empByCode) return empByCode._id as Types.ObjectId;

    throw new NotFoundException(`Employee '${employeeId}' does not exist`);
  }
}
