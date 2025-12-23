#!/bin/bash

# TV Photo Slideshow - Deployment Script
# This script deploys the application to AWS

set -e

echo "🚀 Starting deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK is not installed. Installing now...${NC}"
    npm install -g aws-cdk
fi

# Step 1: Deploy AWS Infrastructure
echo -e "\n${YELLOW}📦 Step 1: Deploying AWS Infrastructure...${NC}"
cd aws-infrastructure

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing CDK dependencies..."
    npm install
fi

# Bootstrap CDK (only needed once per account/region)
echo "Bootstrapping CDK..."
cdk bootstrap

# Deploy the stack
echo "Deploying CDK stack..."
cdk deploy --require-approval never --outputs-file cdk-outputs.json

# Extract outputs
PHOTOS_BUCKET=$(cat cdk-outputs.json | grep "PhotosBucketName" | cut -d'"' -f4)
WEBAPP_BUCKET=$(cat cdk-outputs.json | grep "WebAppBucketName" | cut -d'"' -f4)
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='${WEBAPP_BUCKET}.s3.amazonaws.com']].Id" --output text)
DISTRIBUTION_DOMAIN=$(cat cdk-outputs.json | grep "DistributionDomainName" | cut -d'"' -f4)
IDENTITY_POOL_ID=$(cat cdk-outputs.json | grep "IdentityPoolId" | cut -d'"' -f4)
REGION=$(cat cdk-outputs.json | grep "Region" | cut -d'"' -f4)

echo -e "${GREEN}✅ Infrastructure deployed successfully!${NC}"
echo "Photos Bucket: $PHOTOS_BUCKET"
echo "Web App Bucket: $WEBAPP_BUCKET"
echo "CloudFront Domain: $DISTRIBUTION_DOMAIN"
echo "Identity Pool ID: $IDENTITY_POOL_ID"

cd ..

# Step 2: Create .env file
echo -e "\n${YELLOW}📝 Step 2: Creating environment configuration...${NC}"
cat > .env << EOF
VITE_AWS_IDENTITY_POOL_ID=${IDENTITY_POOL_ID}
VITE_AWS_REGION=${REGION}
VITE_S3_PHOTOS_BUCKET=${PHOTOS_BUCKET}
VITE_CLOUDFRONT_DOMAIN=${DISTRIBUTION_DOMAIN}
EOF

echo -e "${GREEN}✅ Environment configuration created!${NC}"

# Step 3: Build the React app
echo -e "\n${YELLOW}🔨 Step 3: Building React application...${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing app dependencies..."
    npm install
fi

# Build the app
npm run build

echo -e "${GREEN}✅ Application built successfully!${NC}"

# Step 4: Deploy to S3
echo -e "\n${YELLOW}☁️  Step 4: Uploading to S3...${NC}"
aws s3 sync dist/ "s3://${WEBAPP_BUCKET}/" --delete

echo -e "${GREEN}✅ Files uploaded to S3!${NC}"

# Step 5: Invalidate CloudFront cache
echo -e "\n${YELLOW}🔄 Step 5: Invalidating CloudFront cache...${NC}"
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*"

echo -e "${GREEN}✅ CloudFront cache invalidated!${NC}"

# Final output
echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "\n${YELLOW}📱 Your TV Slideshow app is available at:${NC}"
echo -e "${GREEN}https://${DISTRIBUTION_DOMAIN}${NC}"
echo -e "\n${YELLOW}📸 To upload photos, run:${NC}"
echo -e "${GREEN}aws s3 sync ./your-photos-folder s3://${PHOTOS_BUCKET}/${NC}"
echo -e "\n${YELLOW}📝 Next steps:${NC}"
echo "1. Upload your photos to the S3 bucket"
echo "2. Open the app URL in your TV browser"
echo "3. Configure settings (press MENU on your TV remote)"
echo "4. Enter the S3 bucket name: ${PHOTOS_BUCKET}"
echo "5. Enjoy your photo slideshow!"
