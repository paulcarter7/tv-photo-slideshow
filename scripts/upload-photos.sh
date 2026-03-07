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
PREFIX=${2:-"photos/"}

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

# Convert HEIC files to JPEG
HEIC_COUNT=$(find "$PHOTOS_DIR" -type f -iname "*.heic" | wc -l | tr -d ' ')
UPLOAD_DIR="$PHOTOS_DIR"

if [ "$HEIC_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}🔄 Found $HEIC_COUNT HEIC files — converting to JPEG...${NC}"

    if ! command -v sips &> /dev/null; then
        echo -e "${RED}❌ sips not found (requires macOS). HEIC files will be skipped.${NC}"
    else
        UPLOAD_DIR=$(mktemp -d)
        trap "rm -rf '$UPLOAD_DIR'" EXIT

        # Copy non-HEIC files
        find "$PHOTOS_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.webp" \) -exec cp {} "$UPLOAD_DIR/" \;

        # Convert HEIC to JPEG
        find "$PHOTOS_DIR" -type f -iname "*.heic" | while read -r heic_file; do
            basename="${heic_file##*/}"
            jpg_name="${basename%.*}.jpg"
            sips -s format jpeg -s formatOptions 90 "$heic_file" --out "$UPLOAD_DIR/$jpg_name" > /dev/null 2>&1
            echo "  Converted: $basename → $jpg_name"
        done

        # Recount
        PHOTO_COUNT=$(find "$UPLOAD_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.webp" \) | wc -l | tr -d ' ')
        echo -e "${GREEN}✅ Converted $HEIC_COUNT HEIC files. $PHOTO_COUNT photos ready to upload.${NC}"
    fi
fi

# Confirm upload
read -p "Continue with upload? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Upload cancelled."
    exit 0
fi

# Upload photos
echo -e "\n${YELLOW}⬆️  Uploading photos...${NC}"
aws s3 sync "$UPLOAD_DIR" "s3://$VITE_S3_PHOTOS_BUCKET/$PREFIX" \
    --exclude "*" \
    --include "*.jpg" --include "*.JPG" \
    --include "*.jpeg" --include "*.JPEG" \
    --include "*.png" --include "*.PNG" \
    --include "*.gif" --include "*.GIF" \
    --include "*.webp" --include "*.WEBP" \
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
