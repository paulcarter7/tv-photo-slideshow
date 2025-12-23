# AWS Setup Guide

This guide walks you through setting up AWS for the TV Photo Slideshow application.

## Prerequisites

1. **AWS Account**: Create one at [aws.amazon.com](https://aws.amazon.com)
2. **AWS CLI**: Install from [aws.amazon.com/cli](https://aws.amazon.com/cli/)
3. **AWS CDK**: Install with `npm install -g aws-cdk`

## Step 1: Configure AWS CLI

### Create IAM User

1. Sign in to AWS Console
2. Go to IAM → Users → Add User
3. User name: `tv-slideshow-deployer`
4. Enable: **Programmatic access**
5. Attach policies:
   - `AdministratorAccess` (for initial setup)
   - Or create custom policy (see below)

### Configure Credentials

```bash
aws configure
```

Enter:
- AWS Access Key ID: `YOUR_ACCESS_KEY`
- AWS Secret Access Key: `YOUR_SECRET_KEY`
- Default region: `us-east-1` (or your preferred region)
- Default output format: `json`

### Verify Configuration

```bash
aws sts get-caller-identity
```

## Step 2: Bootstrap AWS CDK

CDK needs to be bootstrapped once per account/region:

```bash
cd tv-photo-slideshow/aws-infrastructure
cdk bootstrap
```

This creates:
- CDK staging bucket
- IAM roles for deployments
- CloudFormation stack

## Step 3: Deploy Infrastructure

### Automatic Deployment (Recommended)

```bash
cd tv-photo-slideshow
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Manual Deployment

```bash
cd aws-infrastructure
npm install
cdk deploy --all
```

## Step 4: Verify Deployment

Check the CloudFormation console:
1. Go to AWS Console → CloudFormation
2. Find stack: `TvSlideshowStack`
3. Check **Outputs** tab for:
   - PhotosBucketName
   - DistributionDomainName
   - IdentityPoolId

## Infrastructure Components

### S3 Buckets

#### Photos Bucket
- **Purpose**: Store your photos
- **Name**: `tv-slideshow-photos-{account-id}`
- **Access**: Private (via Cognito Identity Pool)
- **CORS**: Enabled for browser access

#### Web App Bucket
- **Purpose**: Host the React application
- **Name**: `tv-slideshow-app-{account-id}`
- **Access**: Via CloudFront only
- **Website**: Enabled

### CloudFront Distribution

- **Purpose**: Fast global content delivery
- **Origin**: Web App S3 Bucket
- **Cache**: Optimized for static content
- **HTTPS**: Required
- **Error Pages**: Redirects to index.html (SPA support)

### Cognito Identity Pool

- **Purpose**: Provide temporary AWS credentials
- **Type**: Unauthenticated access enabled
- **Permissions**: Read-only access to photos bucket

## Security Best Practices

### 1. Restrict S3 Bucket Access

For production, limit Cognito access:

```typescript
// In aws-infrastructure/lib/tv-slideshow-stack.ts
photosBucket.grantRead(unauthenticatedRole, 'prefix/*');
```

### 2. Enable Authentication

Add authentication provider to Cognito:

```typescript
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'tv-slideshow-users',
  selfSignUpEnabled: true,
  signInAliases: { email: true }
});

identityPool.authenticatedRole = authenticatedRole;
```

### 3. Use CloudFront Signed URLs

For private photo access:

```typescript
const cfFunction = new cloudfront.Function(this, 'SignUrlFunction', {
  code: cloudfront.FunctionCode.fromFile({
    filePath: 'functions/sign-url.js',
  }),
});
```

### 4. Enable Logging

```typescript
photosBucket.addLifecycleRule({
  enabled: true,
  expiration: cdk.Duration.days(90),
  transitions: [{
    storageClass: s3.StorageClass.GLACIER,
    transitionAfter: cdk.Duration.days(30),
  }],
});
```

## Cost Optimization

### 1. S3 Intelligent-Tiering

```typescript
photosBucket.addLifecycleRule({
  enabled: true,
  transitions: [{
    storageClass: s3.StorageClass.INTELLIGENT_TIERING,
    transitionAfter: cdk.Duration.days(0),
  }],
});
```

### 2. CloudFront Pricing Class

Use only necessary regions:

```typescript
distribution.priceClass = cloudfront.PriceClass.PRICE_CLASS_100; // US & Europe only
```

### 3. S3 Request Optimization

- Enable CloudFront caching (long TTL)
- Use S3 Select for large datasets
- Batch upload photos

## Monitoring

### CloudWatch Metrics

View in AWS Console → CloudWatch:

- S3 bucket metrics
- CloudFront requests/errors
- Cognito authentication events

### Set Up Alarms

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name tv-slideshow-high-costs \
  --alarm-description "Alert when costs exceed $20" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold
```

## Troubleshooting

### CDK Bootstrap Fails

```bash
# Check AWS credentials
aws sts get-caller-identity

# Use specific profile
export AWS_PROFILE=my-profile
cdk bootstrap --profile my-profile
```

### Deployment Fails

```bash
# Check CDK version
cdk --version

# Update CDK
npm update -g aws-cdk

# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name TvSlideshowStack
```

### Permission Errors

Ensure IAM user has these permissions:
- s3:*
- cloudfront:*
- cognito-identity:*
- cloudformation:*
- iam:CreateRole
- iam:AttachRolePolicy

### CORS Errors

Verify S3 CORS configuration:

```bash
aws s3api get-bucket-cors --bucket tv-slideshow-photos-ACCOUNT_ID
```

## Updating Infrastructure

### Update CDK Code

1. Edit `aws-infrastructure/lib/tv-slideshow-stack.ts`
2. Run `cdk diff` to see changes
3. Run `cdk deploy` to apply

### Destroy Infrastructure

```bash
cd aws-infrastructure
cdk destroy --all
```

**Warning**: This will delete all resources including photos (if retention policy allows).

## Multi-Region Deployment

Deploy to multiple regions:

```typescript
// In bin/app.ts
new TvSlideshowStack(app, 'TvSlideshowStack-US', {
  env: { region: 'us-east-1' }
});

new TvSlideshowStack(app, 'TvSlideshowStack-EU', {
  env: { region: 'eu-west-1' }
});
```

## Custom Domain

Add custom domain to CloudFront:

```typescript
const certificate = acm.Certificate.fromCertificateArn(
  this,
  'Certificate',
  'arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID'
);

distribution.addAlias('photos.example.com');
distribution.certificate = certificate;
```

## Backup Strategy

### Automatic S3 Versioning

Already enabled in the CDK stack.

### Cross-Region Replication

```typescript
photosBucket.addCorsRule({
  allowedOrigins: ['*'],
  allowedMethods: [s3.HttpMethods.GET],
});

const replicationRole = new iam.Role(this, 'ReplicationRole', {
  assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
});

// Configure replication
cfnBucket.replicationConfiguration = {
  role: replicationRole.roleArn,
  rules: [{
    destination: {
      bucket: backupBucket.bucketArn,
    },
    status: 'Enabled',
  }],
};
```

## Support

For AWS-specific issues:
- Check [AWS Documentation](https://docs.aws.amazon.com)
- Visit [AWS Support Center](https://console.aws.amazon.com/support)
- Review [CDK Examples](https://github.com/aws-samples/aws-cdk-examples)

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)
- [Cognito Identity Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html)
