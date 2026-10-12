import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { getModelToken } from '@nestjs/mongoose';
import { Employee } from './schemas/employee.schema';
import { Invitation } from './schemas/invitation.schema';
import { User } from '../users/schemas/user.schema';
import { SequenceService } from '../database/sequence.service';
import { ReferenceValidatorService } from '../database/reference-validator.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let mockEmployeeModel: any;
  let mockInvitationModel: any;
  let mockUserModel: any;
  let mockSequenceService: any;
  let mockValidatorService: any;
  let mockMailService: any;
  let mockAuditService: any;

  beforeEach(async () => {

    mockEmployeeModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    mockInvitationModel = {
      create: jest.fn(),
    };
    mockUserModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    mockSequenceService = {
      getNextSequence: jest.fn().mockResolvedValue('EMP-000001'),
    };
    mockValidatorService = {
      validateDepartment: jest.fn().mockResolvedValue(null),
      validateTeam: jest.fn().mockResolvedValue(null),
      validatePosition: jest.fn().mockResolvedValue(null),
      validateRole: jest.fn().mockResolvedValue(null),
    };
    mockMailService = {
      sendInvitationEmail: jest.fn().mockResolvedValue(true),
    };
    mockAuditService = {
      log: jest.fn().mockResolvedValue({}),
      findAll: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getModelToken(Employee.name), useValue: mockEmployeeModel },
        { provide: getModelToken(Invitation.name), useValue: mockInvitationModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: SequenceService, useValue: mockSequenceService },
        { provide: ReferenceValidatorService, useValue: mockValidatorService },
        { provide: MailService, useValue: mockMailService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();


    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find employee by sequential employeeId', async () => {
    const mockEmp = {
      _id: '507f1f77bcf86cd799439011',
      employeeId: 'EMP-000001',
      name: 'John Doe',
      email: 'john@example.com',
    };

    mockEmployeeModel.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmp),
            }),
          }),
        }),
      }),
    });

    const result = await service.findByIdOrEmployeeId('EMP-000001');
    expect(result.employeeId).toBe('EMP-000001');
    expect(result.name).toBe('John Doe');
  });

  it('should throw NotFoundException if employee is not found', async () => {
    mockEmployeeModel.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(null),
            }),
          }),
        }),
      }),
    });

    await expect(service.findByIdOrEmployeeId('NON_EXISTENT')).rejects.toThrow(
      NotFoundException,
    );
  });
});
