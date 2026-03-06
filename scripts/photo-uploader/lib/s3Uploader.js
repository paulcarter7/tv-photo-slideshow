import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import path from 'path';

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp'
};

/**
 * Create an S3 client
 * Uses the default AWS credential provider chain:
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 2. Shared credentials file (~/.aws/credentials)
 * 3. IAM role (if running on EC2/ECS)
 */
export function createS3Client(region) {
  return new S3Client({ region });
}

/**
 * Test S3 bucket access
 */
export async function testBucketAccess(s3Client, bucket) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { success: true };
  } catch (error) {
    if (error.name === 'NotFound') {
      return { success: false, error: `Bucket not found: ${bucket}` };
    }
    if (error.name === 'CredentialsProviderError' || error.message?.includes('credentials')) {
      return {
        success: false,
        error: 'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY or configure ~/.aws/credentials'
      };
    }
    if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
      return { success: false, error: `Access denied to bucket: ${bucket}` };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Get content type for a file
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Upload a single file to S3 with retry logic
 */
export async function uploadFile(s3Client, filePath, bucket, keyPrefix = '') {
  const filename = path.basename(filePath);
  const key = keyPrefix ? `${keyPrefix}${filename}` : filename;
  const contentType = getContentType(filePath);

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileBuffer = await readFile(filePath);

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType
      });

      const response = await s3Client.send(command);

      return {
        success: true,
        key,
        etag: response.ETag,
        size: fileBuffer.length
      };
    } catch (error) {
      lastError = error;

      // Don't retry on permission errors
      if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
        break;
      }

      // Retry with exponential backoff
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }

  return {
    success: false,
    key,
    error: lastError?.message || 'Unknown error'
  };
}

/**
 * Upload multiple files to S3
 */
export async function uploadBatch(s3Client, files, bucket, options = {}) {
  const { prefix = '', onProgress = null } = options;

  const results = {
    succeeded: [],
    failed: []
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }

    const result = await uploadFile(s3Client, file.path, bucket, prefix);

    if (result.success) {
      results.succeeded.push({
        ...file,
        key: result.key,
        etag: result.etag
      });
    } else {
      results.failed.push({
        ...file,
        key: result.key,
        error: result.error
      });
    }
  }

  return results;
}
