#!/bin/bash

# TV Photo Slideshow - Photo Upload Script
# This script uploads photos to your S3 bucket

set -e

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

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found. Please run deploy.sh first.${NC}"
    exit 1
fi

# Load environment variables
export $(cat .env | xargs)

# Check if BUCKET_NAME is set
if [ -z "$VITE_S3_PHOTOS_BUCKET" ]; then
    echo -e "${RED}❌ S3 bucket name not found in .env file.${NC}"
    exit 1
fi

# Get photos directory from user
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <photos-directory> [prefix]${NC}"
    echo -e "${YELLOW}Example: $0 ./my-photos vacation2024/${NC}"
    exit 1
fi

PHOTOS_DIR=$1
PREFIX=${2:-""}

# Check if directory exists
if [ ! -d "$PHOTOS_DIR" ]; then
    echo -e "${RED}❌ Directory not found: $PHOTOS_DIR${NC}"
    exit 1
fi

# Count photos
PHOTO_COUNT=$(find "$PHOTOS_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.webp" -o -iname "*.heic" \) | wc -l)

if [ "$PHOTO_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ No photos found in $PHOTOS_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}📸 Found $PHOTO_COUNT photos in $PHOTOS_DIR${NC}"
echo -e "${YELLOW}☁️  Uploading to s3://$VITE_S3_PHOTOS_BUCKET/$PREFIX${NC}"
echo ""

# Confirm upload
read -p "Continue with upload? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Upload cancelled."
    exit 0
fi

# Upload photos
echo -e "\n${YELLOW}⬆️  Uploading photos...${NC}"
aws s3 sync "$PHOTOS_DIR" "s3://$VITE_S3_PHOTOS_BUCKET/$PREFIX" \
    --exclude "*" \
    --include "*.jpg" --include "*.JPG" \
    --include "*.jpeg" --include "*.JPEG" \
    --include "*.png" --include "*.PNG" \
    --include "*.gif" --include "*.GIF" \
    --include "*.webp" --include "*.WEBP" \
    --include "*.heic" --include "*.HEIC" \
    --metadata-directive COPY

echo -e "\n${GREEN}✅ Upload completed successfully!${NC}"
echo -e "\n${YELLOW}📝 Next steps:${NC}"
echo "1. Open your TV Slideshow app"
echo "2. Press MENU to open settings"
echo "3. Configure S3 bucket: $VITE_S3_PHOTOS_BUCKET"
if [ ! -z "$PREFIX" ]; then
    echo "4. Set S3 prefix: $PREFIX"
fi
echo "5. Save and enjoy your slideshow!"
