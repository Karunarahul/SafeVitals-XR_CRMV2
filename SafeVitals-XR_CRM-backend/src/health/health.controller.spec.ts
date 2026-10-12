import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { getConnectionToken } from '@nestjs/mongoose';
import { HttpStatus } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;
  let mockConnection: any;

  beforeEach(async () => {
    mockConnection = {
      readyState: 1,
      name: 'safevitals_crm',
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return ok for liveness', () => {
    const res = controller.checkLiveness();
    expect(res.status).toBe('ok');
    expect(res.uptime).toBeGreaterThanOrEqual(0);
    expect(res.timestamp).toBeDefined();
  });

  it('should return 200 when database is ready', () => {
    const resMock: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    controller.checkReadiness(resMock);
    expect(resMock.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(resMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        details: {
          database: {
            status: 'up',
            name: 'safevitals_crm',
          },
        },
      }),
    );
  });

  it('should return 503 when database is disconnected', () => {
    mockConnection.readyState = 0;
    const resMock: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    controller.checkReadiness(resMock);
    expect(resMock.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(resMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
      }),
    );
  });
});
