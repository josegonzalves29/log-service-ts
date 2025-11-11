import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export class LogServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const table = new dynamodb.Table(this,'LogEntriesTable', {
            partitionKey:{
                name: 'PK',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey:{
                name: 'SK',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: false
            }
        });

        const ingestLambda = new lambda.Function(this, 'IngestFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambda/ingest')),
            environment: {
                TABLE_NAME: table.tableName
            },
            timeout:cdk.Duration.seconds(10)
        });

        table.grantWriteData(ingestLambda);

        const readRecentLambda = new lambda.Function(this, 'ReadRecentFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../dist/lambda/readRecent')),
            environment: {
                TABLE_NAME: table.tableName
            },
            timeout:cdk.Duration.seconds(10)
        });

        table.grantReadData(readRecentLambda);

        const ingestUrl = ingestLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors:{
                allowedOrigins: ['*'],
                allowedMethods: [lambda.HttpMethod.POST],
                allowedHeaders: ['*']
            }
        });

        const readRecentUrl = readRecentLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors:{
                allowedOrigins: ['*'],
                allowedMethods: [lambda.HttpMethod.GET],
                allowedHeaders: ['*']
            }
        });

        new cdk.CfnOutput(this, 'IngestLambdaUrl', {
            value: ingestUrl.url,
            description:'URL for the Ingest Lambda function'
        });

        new cdk.CfnOutput(this, 'ReadRecentLambdaUrl', {
            value: readRecentUrl.url,
            description:'URL for the Read Recent Lambda function'
        });
    }
}