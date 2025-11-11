import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LogEntryResponse, ReadRecentResponse } from './types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try{
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': 'LOG'
            },
            ScanIndexForward: false,
            Limit: 100
    })
);

const logs: LogEntryResponse[] = (result.Items || []).map((item) => ({
    id: item.ID,
    dateTime: item.DateTime,
    severity: item.Severity,
    message: item.Message
}));

const response: ReadRecentResponse = {
    logs,
    count: logs.length
};

return{
    statusCode: 200,
    body: JSON.stringify(response)
};
} catch (error) {
    console.error('Error:', error);
    return{
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' })
    };
}
};



