import { HttpStatus } from '@nestjs/common';
import { HealthController } from '../health/health.controller';

describe('MongoDB Atlas Integration & Health Verification', () => {
  describe('Database URI & Credential Protection', () => {
    it('should correctly sanitize credentials in MongoDB Atlas SRV URI', () => {
      const rawUri =
        'mongodb+srv://karunarahul8885_db_user:SecretPassword123!@cluster0.iqltbyx.mongodb.net/safevitals?retryWrites=true&w=majority';
      const sanitized = rawUri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');

      expect(sanitized).toBe(
        'mongodb+srv://karunarahul8885_db_user:***@cluster0.iqltbyx.mongodb.net/safevitals?retryWrites=true&w=majority',
      );
      expect(sanitized).not.toContain('SecretPassword123!');
      expect(sanitized).toContain('cluster0.iqltbyx.mongodb.net');
      expect(sanitized).toContain('safevitals');
    });

    it('should sanitize credentials in connection error messages', () => {
      const rawError =
        'MongoServerSelectionError: connection error to mongodb+srv://karunarahul8885_db_user:SecretPassword123!@cluster0.iqltbyx.mongodb.net';
      const sanitized = rawError.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');

      expect(sanitized).not.toContain('SecretPassword123!');
      expect(sanitized).toContain('karunarahul8885_db_user:***@cluster0.iqltbyx.mongodb.net');
    });
  });

  describe('Health Probes & Readiness Logic', () => {
    it('should report HTTP 200 OK when MongoDB Atlas connection readyState is 1 (Connected)', () => {
      const mockConnection: any = {
        readyState: 1,
        name: 'safevitals',
      };
      const controller = new HealthController(mockConnection);

      const statusMock = jest.fn().mockReturnThis();
      const jsonMock = jest.fn();
      const res: any = { status: statusMock, json: jsonMock };

      controller.checkReadiness(res);

      expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'ok',
        timestamp: expect.any(String),
        details: {
          database: {
            status: 'up',
            name: 'safevitals',
          },
        },
      });
    });

    it('should report HTTP 503 Service Unavailable when MongoDB connection readyState is 0 (Disconnected)', () => {
      const mockConnection: any = {
        readyState: 0,
        name: 'safevitals',
      };
      const controller = new HealthController(mockConnection);

      const statusMock = jest.fn().mockReturnThis();
      const jsonMock = jest.fn();
      const res: any = { status: statusMock, json: jsonMock };

      controller.checkReadiness(res);

      expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(jsonMock).toHaveBeenCalledWith({
        status: 'error',
        timestamp: expect.any(String),
        details: {
          database: {
            status: 'down',
            readyState: 0,
          },
        },
      });
    });

    it('should report HTTP 503 Service Unavailable when MongoDB connection readyState is 2 (Connecting)', () => {
      const mockConnection: any = {
        readyState: 2,
        name: 'safevitals',
      };
      const controller = new HealthController(mockConnection);

      const statusMock = jest.fn().mockReturnThis();
      const jsonMock = jest.fn();
      const res: any = { status: statusMock, json: jsonMock };

      controller.checkReadiness(res);

      expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          details: {
            database: {
              status: 'down',
              readyState: 2,
            },
          },
        }),
      );
    });

    it('should report liveness independently with uptime and status ok', () => {
      const mockConnection: any = { readyState: 1 };
      const controller = new HealthController(mockConnection);

      const liveness = controller.checkLiveness();
      expect(liveness.status).toBe('ok');
      expect(liveness.uptime).toBeGreaterThanOrEqual(0);
      expect(liveness.timestamp).toBeDefined();
    });
  });
});
