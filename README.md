# Serverless Log Service

A serverless log aggregation service I built to learn AWS Lambda, DynamoDB, and Infrastructure as Code with AWS CDK.

## Table of Contents

- [Requirements](#requirements)
- [Architecture](#architecture)
- [Database Design](#database-design)
  - [Why DynamoDB?](#why-dynamodb)
  - [DynamoDB Schema](#dynamodb-schema)
- [Deployment Instructions](#deployment-instructions)
- [Testing the Service](#testing-the-service)
- [Testing](#testing)
- [What I Learned](#what-i-learned)
- [Troubleshooting](#troubleshooting)
- [Technologies Used](#technologies-used)

## Requirements

Design and implement a simple log service that stores and retrieves log entries using an AWS database and two AWS Lambda functions.

**Log Entry Format:**
- **ID**: Unique identifier
- **DateTime**: Timestamp when log was created
- **Severity**: One of `info`, `warning`, or `error`
- **Message**: The log message text

## Architecture

### System Overview

The system consists of two serverless Lambda functions that interact with a DynamoDB database to provide log ingestion and retrieval capabilities.

**Request Flow for Creating Logs:**

1. Client sends HTTP POST request to Ingest Lambda Function URL
2. Ingest Lambda receives the request and validates the input (severity and message)
3. Lambda generates a unique UUID for the log entry
4. Lambda adds an ISO 8601 timestamp
5. Lambda stores the complete log entry in DynamoDB using PutItem operation
6. Lambda returns HTTP 201 response with the generated log ID

**Request Flow for Retrieving Logs:**

1. Client sends HTTP GET request to ReadRecent Lambda Function URL
2. ReadRecent Lambda executes a DynamoDB Query operation
3. Query uses partition key "LOG" and sort key (timestamp) in descending order
4. DynamoDB returns up to 100 most recent log entries, automatically sorted
5. Lambda transforms the DynamoDB items to a clean response format
6. Lambda returns HTTP 200 response with the logs array and count

### Components

1. **Ingest Lambda Function**
   - **Purpose**: Accept and store log entries
   - **Trigger**: Lambda Function URL (HTTP POST)
   - **Runtime**: Node.js 20.x (TypeScript)
   - **Permissions**: DynamoDB write access (PutItem, UpdateItem)
   - **Validation**: Checks severity (info/warning/error), message length (<1000 chars)

2. **ReadRecent Lambda Function**
   - **Purpose**: Retrieve the 100 most recent log entries
   - **Trigger**: Lambda Function URL (HTTP GET)
   - **Runtime**: Node.js 20.x (TypeScript)
   - **Permissions**: DynamoDB read access (Query, GetItem)
   - **Query**: Uses DynamoDB Query operation with descending sort

3. **DynamoDB Table**
   - **Billing**: Pay-per-request (no provisioned capacity)
   - **Partition Key**: `PK` (String)
   - **Sort Key**: `SK` (String)
   - **Deletion Policy**: DESTROY (for development)

4. **AWS CDK Infrastructure**
   - **Language**: TypeScript
   - **Defines**: All AWS resources (table, functions, permissions, URLs)
   - **Output**: Function URLs for testing

## Database Design

### Why DynamoDB?

I chose DynamoDB over other AWS database options for several reasons:

**DynamoDB Advantages:**
- **Simple access pattern** - I only need two operations: write a log, read recent logs. No complex queries or joins required.
- **Serverless and scalable** - Automatically scales with traffic, no capacity planning needed.
- **Fast reads** - Single-digit millisecond latency for queries using partition and sort keys.
- **Pay-per-request pricing** - Only pay for actual reads/writes, not idle database capacity.
- **Perfect for time-series data** - Built-in sorting with sort keys makes "most recent 100" queries efficient.

**Trade-offs vs Alternatives:**

**vs RDS (PostgreSQL/MySQL):**
- RDS would require managing instance size and dealing with connection pooling from Lambda.
- For simple key-value lookups, RDS is overkill. I'd be paying for ACID transactions, foreign keys, and complex query capabilities I don't need.
- DynamoDB's pay-per-request is cheaper for sporadic traffic patterns.

**vs Aurora Serverless:**
- Aurora Serverless would work, but it has a cold start delay when scaling from zero.
- Still requires SQL and connection management.
- More expensive for simple read/write patterns.

**vs ElastiCache/Redis:**
- Redis is great for caching but not designed as a primary data store.
- No native persistence guarantees compared to DynamoDB's durability.
- Would need a separate database anyway for permanent storage.

**When NOT to use DynamoDB:**
- If you need complex queries across multiple attributes (SQL's WHERE clauses with AND/OR).
- If you need transactions across multiple items.
- If you need to change access patterns frequently (DynamoDB requires designing for specific queries upfront).

For this log service use case, DynamoDB is the right choice because the access patterns are simple and well-defined.

### DynamoDB Schema

The database uses a single-table design optimized for retrieving the most recent logs efficiently.

#### Table Structure

| Attribute | Type | Key Type | Description |
|-----------|------|----------|-------------|
| **PK** | String | Partition Key | Always set to `"LOG"` - groups all log entries together |
| **SK** | String | Sort Key | ISO 8601 timestamp (e.g., `"2025-11-11T14:43:08.135Z"`) |
| **ID** | String | Attribute | UUID v4 for unique identification |
| **Severity** | String | Attribute | Log level: `"info"`, `"warning"`, or `"error"` |
| **Message** | String | Attribute | Log message content (max 1000 characters) |
| **DateTime** | String | Attribute | Same as SK - stored for convenience |

#### Example Item

```json
{
  "PK": "LOG",
  "SK": "2025-11-11T14:43:08.135Z",
  "ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "Severity": "error",
  "Message": "Database connection timeout",
  "DateTime": "2025-11-11T14:43:08.135Z"
}
```

### Why This Design?

#### 1. **Single Partition Strategy**

I grouped all logs under a single partition key (`PK = "LOG"`). This might seem counterintuitive at first  wouldn't spreading data across partitions be better? But for this use case, having everything in one partition allows me to query all logs together efficiently. DynamoDB can handle up to 10,000 writes per second on a single partition, which is more than enough for a log service.

#### 2. **Timestamp as Sort Key**

I initially considered using Unix timestamps (numbers) as the sort key, but switched to ISO 8601 strings. They sort correctly and are readable when browsing DynamoDB in the console. The extra 10 bytes of storage per entry is worth it for easier debugging.

#### 3. **Efficient "Most Recent 100" Query**
```typescript
{
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: { ':pk': 'LOG' },
  ScanIndexAscending: false, 
  Limit: 100
}
```

**Performance:**
- Uses **Query** operation (fast) NOT Scan (slow)
- Leverages sort key for automatic ordering
- Limit prevents reading unnecessary data
- Sub-100ms response time

#### 4. **Scalability Considerations**

The single partition approach works well for this project's scale (tested with a few thousand requests). DynamoDB can handle around 10,000 writes per second on a single partition, which is plenty for a log service.

If this needed to scale beyond that, I'd shard by time period (e.g., `PK = "LOG#2025-11"` for November 2025) and add a Global Secondary Index for cross-shard queries. But for learning and most real-world use cases, the simpler single-partition design is better.

### Query vs Scan

| Operation | Use Case | Speed | Cost |
|-----------|----------|-------|------|
| **Query** | Finding items with specific PK | Fast | Low cost |
| **Scan** | Reading entire table | Slow | High cost |

**Our ReadRecent function uses Query** - reads only what's needed, sorted automatically by DynamoDB.

## Deployment Instructions

### Prerequisites

1. **AWS Account** with configured credentials
2. **Node.js** 18+ and npm installed
3. **AWS CLI** configured:
   ```bash
   aws configure
   # Enter: Access Key, Secret Key, Region (e.g., us-east-1)
   ```

### Step 1: Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd log-service-ts

# Install all dependencies
npm install
```

**What gets installed:**
- AWS CDK libraries
- AWS SDK v3 for DynamoDB
- TypeScript and types
- Jest for testing

### Step 2: Build TypeScript

```bash
# Compile TypeScript to JavaScript
npm run build
```

This creates `dist/` folder with compiled Lambda code.

### Step 3: Bootstrap CDK (First Time Only)

```bash
# Set up CDK toolkit resources in your AWS account
npx cdk bootstrap
```

**What this does:**
- Creates S3 bucket for Lambda deployment packages
- Creates IAM roles for CDK operations
- Sets up CloudFormation stack management
- Only needed once per AWS account/region

### Step 4: Preview Changes

```bash
# Generate CloudFormation template
npx cdk synth

# See what will be created
npx cdk diff
```

**Review the output** - you'll see:
- DynamoDB table definition
- Two Lambda functions
- IAM roles and policies
- Function URLs

### Step 5: Deploy to AWS

```bash
# Deploy everything to AWS
npx cdk deploy
```

**Deployment process:**
1. Packages Lambda code into ZIP files
2. Uploads to S3
3. Creates CloudFormation stack
4. Provisions all resources
5. Outputs Function URLs

This usually takes about 60-90 seconds. 

### Step 6: Get Your Function URLs

After deployment completes, CDK will print out your Function URLs:

```
Outputs:
LogServiceStack.IngestLambdaUrl = https://abc123.lambda-url.af-south-1.on.aws/
LogServiceStack.ReadRecentLambdaUrl = https://xyz789.lambda-url.af-south-1.on.aws/

Stack ARN:
arn:aws:cloudformation:af-south-1:123456789:stack/LogServiceStack/...
```

**Save these URLs** - you'll use them to interact with your service!

## Testing the Service

Once deployed, you'll have two HTTP endpoints. The easiest way to test is with curl:

**Create a log entry:**
```bash
curl -X POST <your-ingest-url> \
  -H "Content-Type: application/json" \
  -d '{"severity":"info","message":"User login successful"}'
```

You should get back a JSON response with the log ID.

**Retrieve recent logs:**
```bash
curl <your-readrecent-url>
```

This returns the 100 most recent logs as a JSON array.

You can also test directly in the AWS Lambda console if you prefer a GUI - just navigate to the function and use the Test tab with a sample event.

## Testing

### Run Unit Tests

```bash
# Run all tests
npm test
```

I wrote 14 tests covering both Lambda functions with 100% code coverage. The tests cover:

- Valid input scenarios (all three severity levels)
- Input validation (wrong severity, missing fields, message too long)
- Error handling when DynamoDB fails
- Edge cases like empty results and undefined responses

Writing tests first (TDD-style) helped me catch issues like forgetting to handle `undefined` from DynamoDB when no items exist.

### Manual Testing Flow

1. **Deploy the service** (`npx cdk deploy`)
2. **Create some logs:**
   ```bash
   # Create info log
   curl -X POST https://your-ingest-url/ \
     -H "Content-Type: application/json" \
     -d '{"severity":"info","message":"User logged in"}'
   
   # Create error log
   curl -X POST https://your-ingest-url/ \
     -H "Content-Type: application/json" \
     -d '{"severity":"error","message":"Payment failed"}'
   
   # Create warning log
   curl -X POST https://your-ingest-url/ \
     -H "Content-Type: application/json" \
     -d '{"severity":"warning","message":"High memory usage"}'
   ```

3. **Retrieve logs:**
   ```bash
   curl https://your-readrecent-url/
   ```

4. **Verify:**
   - All 3 logs appear
   - Sorted by newest first
   - All fields present


## What I Learned

I wanted to understand how serverless architectures work in practice, especially DynamoDB's query patterns and how to structure data for efficient retrieval. The main challenge was: how do you efficiently retrieve the "100 most recent" items from a NoSQL database without scanning the entire table? Turns out, using a fixed partition key with timestamps as the sort key was the answer.

**DynamoDB Design Patterns**
- The importance of access patterns in NoSQL design. I spent time upfront thinking about how the data would be queried, which shaped the entire schema.
- Why Query operations are dramatically faster than Scans (milliseconds vs seconds on larger datasets).
- Choosing between Unix timestamps vs ISO 8601 strings for sort keys - readability won over a few bytes of storage.

**Lambda Best Practices**
- Initialize AWS SDK clients outside the handler function - Lambda reuses containers, so this saves initialization time on subsequent invocations.
- Keep functions focused - one responsibility per function makes testing and debugging much easier.
- Understanding cold starts and how to minimize them.

**Infrastructure as Code**
- CDK's TypeScript API is much more intuitive than raw CloudFormation. Being able to use the same language for infrastructure and application code reduced context switching.
- The deployment process (synth → diff → deploy) gives you confidence about what changes before they happen.
- How IAM permissions work with `grantReadData` and `grantWriteData` - CDK handles the complexity.

**Testing Serverless Functions**
- Mocking AWS SDK calls is essential for fast, reliable tests. I used `aws-sdk-client-mock` which worked really well.
- Achieving 100% test coverage forced me to think through edge cases I might have missed.
- TDD helped catch issues like not handling `undefined` from DynamoDB when no items exist.


## Troubleshooting

### "CDK bootstrap required" error

You need to bootstrap CDK once per AWS account and region. Just run `npx cdk bootstrap` and you're good to go.

### Can't see Function URLs after deployment

Check the CloudFormation stack outputs in the AWS Console. The URLs should be there even if they didn't print to your terminal.

### Getting 403 errors when calling the Function URL

Check the CORS configuration in `lib/log-stack.ts`. You might need to adjust the allowed origins or methods depending on how you're calling the API.

### "Table already exists" error during deployment

The table name is already taken. Run `npx cdk destroy` first to clean up, then redeploy.

## Technologies Used

- **AWS Lambda** - Serverless compute
- **Amazon DynamoDB** - NoSQL database
- **AWS IAM** - Identity and access management
- **AWS CloudFormation** - Infrastructure deployment
- **Amazon CloudWatch** - Logging and monitoring
- **AWS CDK** - Infrastructure as Code framework
- **TypeScript** - For both Lambda functions and infrastructure
- **Jest** - Testing framework with aws-sdk-client-mock

---

