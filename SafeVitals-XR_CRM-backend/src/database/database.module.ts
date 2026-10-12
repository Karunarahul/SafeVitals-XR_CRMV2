import { Module, Global, Logger } from '@nestjs/common';
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
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MongoDB');
        const uri = configService.get<string>('database.uri') || '';
        const dbName = configService.get<string>('database.name') || 'safevitals';
        const sanitizedUri = uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
        logger.log(`Connecting to MongoDB cluster: ${sanitizedUri} [Database: ${dbName}]`);

        return {
          uri,
          dbName,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
          connectionErrorFactory: (error) => {
            const sanitizedMsg = error.message.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
            logger.error(`[DATABASE_FATAL] MongoDB connection failed: ${sanitizedMsg}`);
            return error;
          },
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              logger.log(`Successfully connected to MongoDB Atlas database '${dbName}'.`);
            });
            connection.on('error', (err: any) => {
              const sanitizedMsg = (err.message || '').replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
              logger.error(`[DATABASE_ERROR] MongoDB error encountered: ${sanitizedMsg}`);
            });
            connection.on('disconnected', () => {
              logger.warn('MongoDB connection lost. Awaiting automatic reconnection...');
            });
            connection.on('reconnected', () => {
              logger.log('MongoDB connection restored.');
            });
            return connection;
          },
        };
      },
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
