import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Counter, CounterSchema } from './schemas/counter.schema';
import { SequenceService } from './sequence.service';
import { SeederService } from './seeder.service';
import { ReferenceValidatorService } from './reference-validator.service';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { Permission, PermissionSchema } from '../permissions/schemas/permission.schema';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { Position, PositionSchema } from '../positions/schemas/position.schema';
import { OrgSettings, OrgSettingsSchema } from '../org-settings/schemas/org-settings.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
    }),
    MongooseModule.forFeature([
      { name: Counter.name, schema: CounterSchema },
      { name: User.name, schema: UserSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Position.name, schema: PositionSchema },
      { name: OrgSettings.name, schema: OrgSettingsSchema },
    ]),
  ],
  providers: [SequenceService, SeederService, ReferenceValidatorService],
  exports: [MongooseModule, SequenceService, SeederService, ReferenceValidatorService],
})
export class DatabaseModule {}
