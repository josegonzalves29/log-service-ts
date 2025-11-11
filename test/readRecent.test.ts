import { handler } from '../lambda/readRecent/index';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
process.env.TABLE_NAME = 'test-table';

describe('ReadRecent Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  describe('Success Cases', () => {
    it('should return logs when data exists', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'LOG',
            SK: '2025-11-11T14:43:08.135Z',
            ID: 'id-1',
            Severity: 'info',
            Message: 'User logged in',
            DateTime: '2025-11-11T14:43:08.135Z'
          },
          {
            PK: 'LOG',
            SK: '2025-11-11T14:42:57.629Z',
            ID: 'id-2',
            Severity: 'error',
            Message: 'Payment failed',
            DateTime: '2025-11-11T14:42:57.629Z'
          },
          {
            PK: 'LOG',
            SK: '2025-11-11T14:42:24.057Z',
            ID: 'id-3',
            Severity: 'warning',
            Message: 'High memory',
            DateTime: '2025-11-11T14:42:24.057Z'
          }
        ]
      });

      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.logs).toBeDefined();
      expect(body.logs).toHaveLength(3);
      expect(body.count).toBe(3);

      expect(body.logs[0]).toEqual({
        id: 'id-1',
        dateTime: '2025-11-11T14:43:08.135Z',
        severity: 'info',
        message: 'User logged in'
      });

      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should return empty array when no logs exist', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: []
      });

      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.logs).toEqual([]);
      expect(body.count).toBe(0);
    });

    it('should handle undefined Items in DynamoDB response', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: undefined
      });

      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.logs).toEqual([]);
      expect(body.count).toBe(0);
    });

    it('should correctly transform all severity types', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'LOG',
            SK: '2025-11-11T14:00:03.000Z',
            ID: 'id-info',
            Severity: 'info',
            Message: 'Info message',
            DateTime: '2025-11-11T14:00:03.000Z'
          },
          {
            PK: 'LOG',
            SK: '2025-11-11T14:00:02.000Z',
            ID: 'id-warning',
            Severity: 'warning',
            Message: 'Warning message',
            DateTime: '2025-11-11T14:00:02.000Z'
          },
          {
            PK: 'LOG',
            SK: '2025-11-11T14:00:01.000Z',
            ID: 'id-error',
            Severity: 'error',
            Message: 'Error message',
            DateTime: '2025-11-11T14:00:01.000Z'
          }
        ]
      });

      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.logs).toHaveLength(3);
      expect(body.logs[0].severity).toBe('info');
      expect(body.logs[1].severity).toBe('warning');
      expect(body.logs[2].severity).toBe('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB query failed'));

      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });
  });
});