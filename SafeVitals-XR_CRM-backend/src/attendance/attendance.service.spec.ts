import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { getModelToken } from '@nestjs/mongoose';
import { Attendance } from './schemas/attendance.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('AttendanceService Business Integrity', () => {
  let service: AttendanceService;
  let mockAttendanceModel: any;
  let mockEmployeeModel: any;

  beforeEach(async () => {
    mockAttendanceModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };
    mockEmployeeModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getModelToken(Attendance.name), useValue: mockAttendanceModel },
        { provide: getModelToken(Employee.name), useValue: mockEmployeeModel },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  it('should prevent duplicate check-in if user has already checked in today', async () => {
    const mockEmp = {
      _id: new Types.ObjectId(),
      employeeId: 'EMP-000001',
      userId: new Types.ObjectId(),
    };

    mockEmployeeModel.findById.mockResolvedValue(mockEmp);

    mockAttendanceModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(),
      employeeId: 'EMP-000001',
      checkIn: new Date(),
    });

    await expect(
      service.checkIn(
        {
          userId: mockEmp.userId.toString(),
          employeeDocId: mockEmp._id.toString(),
          email: 'test@example.com',
          role: 'Employee',
        },
        { workMode: 'office' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should prevent starting a break when already on a break', async () => {
    const mockEmp = {
      _id: new Types.ObjectId(),
      employeeId: 'EMP-000001',
      userId: new Types.ObjectId(),
    };

    mockEmployeeModel.findById.mockResolvedValue(mockEmp);

    const activeBreakRecord = {
      checkIn: new Date(Date.now() - 3600000),
      breaks: [{ start: new Date(), end: null }],
    };

    mockAttendanceModel.findOne.mockResolvedValue(activeBreakRecord);

    await expect(
      service.startBreak({
        userId: mockEmp.userId.toString(),
        employeeDocId: mockEmp._id.toString(),
        email: 'test@example.com',
        role: 'Employee',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
