import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LogServiceStack } from '../lib/log-stack';

const app = new cdk.App();

new LogServiceStack(app, 'LogServiceStack', {
    description: 'Log Service with Lambda and DynamoDB',
});

app.synth();
