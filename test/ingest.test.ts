import { handler } from '../lambda/ingest/index';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
process.env.TABLE_NAME = 'test-table';

describe('Ingest Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  describe('Success Cases', () => {
    it('should create a log entry with valid input', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'info',
          message: 'Test log message'
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(201);
      
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Log entry created');
      expect(body.id).toBeDefined();
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);

      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should accept error severity', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'error',
          message: 'Error message'
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(201);
    });

    it('should accept warning severity', async () => {
      ddbMock.on(PutCommand).resolves({});

      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'warning',
          message: 'Warning message'
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('Validation Failures', () => {
    it('should reject invalid severity', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'debug',
          message: 'Test message'
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
    });

    it('should reject missing message', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'info'
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
    });

    it('should reject empty message', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'info',
          message: ''
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
    });

    it('should reject message longer than 1000 characters', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'info',
          message: 'a'.repeat(1001)
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
    });

    it('should reject null body', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        body: null
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors', async () => {   
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const event: Partial<APIGatewayProxyEvent> = {
        body: JSON.stringify({
          severity: 'info',
          message: 'Test message'
        })
      };

      const result = await handler(event as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });
  });
});