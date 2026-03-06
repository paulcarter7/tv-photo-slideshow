# Photo Uploader CLI

A command-line tool for validating and uploading photos to S3 for the TV Photo Slideshow app.

## Features

- **EXIF Validation**: Only uploads photos with both GPS coordinates AND date/time metadata
- **Batch Upload**: Upload entire directories of photos
- **Dry Run Mode**: Preview what would be uploaded without making changes
- **Progress Reporting**: Clear feedback on validation and upload progress
- **Retry Logic**: Automatic retries for transient network failures

## Installation

```bash
cd scripts/photo-uploader
npm install
```

## Usage

### Basic Usage

```bash
# Upload a directory of photos
node index.js ./my-photos/

# Upload specific files
node index.js photo1.jpg photo2.jpg photo3.jpg

# Upload with recursive directory scanning
node index.js -r ./vacation-photos/

# Dry run (validate only, no upload)
node index.js -n ./photos/
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--recursive` | `-r` | Scan directories recursively | `false` |
| `--dry-run` | `-n` | Validate only, don't upload | `false` |
| `--prefix <prefix>` | `-p` | S3 key prefix (folder) | `photos/` |
| `--bucket <bucket>` | `-b` | S3 bucket name | from `.env` |
| `--region <region>` | | AWS region | from `.env` |
| `--verbose` | `-v` | Show detailed output | `false` |
| `--quiet` | `-q` | Show only errors | `false` |
| `--force` | `-f` | Skip confirmation prompt | `false` |

### Examples

```bash
# Upload to a specific S3 prefix
node index.js -p vacation2024/ ./vacation-photos/

# Override bucket from command line
node index.js -b my-bucket-name ./photos/

# Verbose output showing all rejected files
node index.js -v ./photos/

# Quiet mode for scripting
node index.js -q -f ./photos/

# Full example with all options
node index.js -r -p trips/hawaii/ -v ./photos/hawaii/
```

## AWS Credentials

This tool uses the standard AWS credential chain. Configure credentials using one of these methods:

### Option 1: Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Option 2: AWS Credentials File

Create or edit `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = your-access-key
aws_secret_access_key = your-secret-key
```

### Option 3: AWS CLI

```bash
aws configure
```

### Required IAM Permissions

Your AWS user/role needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:HeadBucket"
      ],
      "Resource": [
        "arn:aws:s3:::tv-slideshow-photos-*",
        "arn:aws:s3:::tv-slideshow-photos-*/*"
      ]
    }
  ]
}
```

## Configuration

The tool reads configuration from the project's `.env` file:

```bash
VITE_S3_PHOTOS_BUCKET=tv-slideshow-photos-123456789
VITE_AWS_REGION=us-west-1
```

You can override these with command-line options `--bucket` and `--region`.

## EXIF Requirements

For a photo to be uploaded, it **must** contain:

1. **GPS Coordinates** (latitude and longitude)
2. **Date/Time** (DateTimeOriginal, DateTime, or CreateDate)

Photos missing either of these fields will be rejected with a clear error message.

### Common Issues

**"Missing GPS coordinates"**
- The photo doesn't have GPS metadata. This usually means:
  - Location services were disabled when the photo was taken
  - The camera/phone doesn't have GPS capability
  - GPS metadata was stripped (e.g., by social media or editing software)

**"Missing date/time"**
- The photo doesn't have a date stamp. This is rare but can happen with:
  - Screenshots or graphics
  - Photos from very old cameras
  - Images that have been heavily processed

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (all valid files uploaded) |
| 1 | Partial success (some uploads failed) |
| 2 | No valid files to upload |
| 3 | Configuration error |

## Troubleshooting

### "AWS credentials not configured"

Make sure you've set up AWS credentials using one of the methods above.

### "Access denied to bucket"

Your AWS credentials don't have permission to write to the bucket. Check your IAM policy.

### "Bucket not found"

The bucket name is incorrect. Check `VITE_S3_PHOTOS_BUCKET` in your `.env` file or use `--bucket`.

### No files are valid

All your photos are missing GPS and/or date metadata. Use `--verbose` to see detailed reasons for each file.
