import { Test, TestingModule } from '@nestjs/testing';
import { LeaveService } from './leave.service';
import { getModelToken } from '@nestjs/mongoose';
import { Leave } from './schemas/leave.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { OrgSettings } from '../org-settings/schemas/org-settings.schema';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('LeaveService Status Transitions', () => {
  let service: LeaveService;
  let mockLeaveModel: any;
  let mockEmployeeModel: any;
  let mockOrgSettingsModel: any;

  beforeEach(async () => {
    mockLeaveModel = {
      findById: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };
    mockEmployeeModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };
    mockOrgSettingsModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leavePolicy: { annualDays: 20, sickDays: 10 },
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: getModelToken(Leave.name), useValue: mockLeaveModel },
        { provide: getModelToken(Employee.name), useValue: mockEmployeeModel },
        { provide: getModelToken(OrgSettings.name), useValue: mockOrgSettingsModel },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
  });

  it('should approve a pending leave request', async () => {
    const leaveId = new Types.ObjectId().toString();
    const reviewerId = new Types.ObjectId().toString();

    const mockLeave = {
      _id: leaveId,
      status: 'pending',
      save: jest.fn().mockResolvedValue(true),
    };

    mockLeaveModel.findById.mockResolvedValue(mockLeave);

    const result = await service.approve(leaveId, reviewerId);
    expect(result.status).toBe('approved');
    expect(mockLeave.save).toHaveBeenCalled();
  });

  it('should reject invalid transition when trying to approve an already approved leave', async () => {
    const leaveId = new Types.ObjectId().toString();
    const reviewerId = new Types.ObjectId().toString();

    const mockLeave = {
      _id: leaveId,
      status: 'approved',
    };

    mockLeaveModel.findById.mockResolvedValue(mockLeave);

    await expect(service.approve(leaveId, reviewerId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject invalid transition when trying to reject an already cancelled leave', async () => {
    const leaveId = new Types.ObjectId().toString();
    const reviewerId = new Types.ObjectId().toString();

    const mockLeave = {
      _id: leaveId,
      status: 'cancelled',
    };

    mockLeaveModel.findById.mockResolvedValue(mockLeave);

    await expect(
      service.reject(leaveId, reviewerId, { reason: 'No longer needed' }),
    ).rejects.toThrow(BadRequestException);
  });
});
