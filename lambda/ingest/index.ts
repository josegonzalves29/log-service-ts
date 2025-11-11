import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { LogEntryInput, LogEntry } from './types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || '';

function validateInput(input: any): input is LogEntryInput {
    return(
        input && typeof input === 'object' &&
        ['info', 'warning', 'error'].includes(input.severity) &&
        typeof input.message === 'string' &&
        input.message.length > 0 &&
        input.message.length <= 1000
    );
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = event.body ? JSON.parse(event.body) : null;

        if(!validateInput(body)) {
            return{
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid input' })
            };
    }

    const now = new Date().toISOString();
    const logEntry: LogEntry = {
        PK: 'LOG',
        SK: now,
        ID: randomUUID(),
        Severity: body.severity,
        Message: body.message,
        DateTime: now
    };

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: logEntry
    }));

    return{
        statusCode: 201,
        body: JSON.stringify({ message: 'Log entry created', id: logEntry.ID })
    }
} catch (error) {
    console.error('Error:', error);
    return{
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' })
    };
}
};