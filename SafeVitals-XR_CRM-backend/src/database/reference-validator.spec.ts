import { Test, TestingModule } from '@nestjs/testing';
import { ReferenceValidatorService } from './reference-validator.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('ReferenceValidatorService', () => {
  let service: ReferenceValidatorService;
  let mockConnection: any;
  let mockCollections: Record<string, any>;

  beforeEach(async () => {
    mockCollections = {
      departments: { findOne: jest.fn() },
      teams: { findOne: jest.fn() },
      positions: { findOne: jest.fn() },
      roles: { findOne: jest.fn() },
      employees: { findOne: jest.fn() },
    };

    mockConnection = {
      collection: jest.fn((name: string) => mockCollections[name]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceValidatorService,
        { provide: getConnectionToken(), useValue: mockConnection },
      ],
    }).compile();

    service = module.get<ReferenceValidatorService>(ReferenceValidatorService);
  });

  it('should throw NotFoundException if department does not exist', async () => {
    const validId = new Types.ObjectId().toString();
    mockCollections.departments.findOne.mockResolvedValue(null);

    await expect(service.validateDepartment(validId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if department is archived', async () => {
    const validId = new Types.ObjectId().toString();
    mockCollections.departments.findOne.mockResolvedValue({
      _id: new Types.ObjectId(validId),
      name: 'Legacy Dept',
      isArchived: true,
    });

    await expect(service.validateDepartment(validId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException if team does not belong to expected department', async () => {
    const teamId = new Types.ObjectId().toString();
    const deptA = new Types.ObjectId().toString();
    const deptB = new Types.ObjectId().toString();

    mockCollections.teams.findOne.mockResolvedValue({
      _id: new Types.ObjectId(teamId),
      name: 'Alpha Team',
      departmentId: new Types.ObjectId(deptA),
      isArchived: false,
    });

    await expect(service.validateTeam(teamId, deptB)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should successfully validate team when department matches', async () => {
    const teamId = new Types.ObjectId().toString();
    const deptA = new Types.ObjectId().toString();

    mockCollections.teams.findOne.mockResolvedValue({
      _id: new Types.ObjectId(teamId),
      name: 'Alpha Team',
      departmentId: new Types.ObjectId(deptA),
      isArchived: false,
    });

    const result = await service.validateTeam(teamId, deptA);
    expect(result.toString()).toBe(teamId);
  });
});
