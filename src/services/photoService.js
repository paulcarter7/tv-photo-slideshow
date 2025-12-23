import AWS from 'aws-sdk';

// Supported image formats
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

/**
 * Initialize AWS S3 client
 */
function initS3Client(region) {
  // Configure AWS SDK
  // For production, use IAM roles or Cognito Identity Pool
  // For development, can use credentials from environment or user input

  AWS.config.update({
    region: region,
    // Credentials should be provided via:
    // 1. IAM role (recommended for EC2/Lambda)
    // 2. Cognito Identity Pool (recommended for browser)
    // 3. Environment variables (development only)
    credentials: new AWS.CognitoIdentityCredentials({
      IdentityPoolId: process.env.VITE_AWS_IDENTITY_POOL_ID || ''
    })
  });

  return new AWS.S3({
    apiVersion: '2006-03-01',
    signatureVersion: 'v4'
  });
}

/**
 * Fetch list of photos from S3 bucket
 * @param {string} bucket - S3 bucket name
 * @param {string} region - AWS region
 * @param {string} prefix - Optional folder prefix
 * @returns {Promise<string[]>} Array of photo URLs
 */
export async function fetchPhotos(bucket, region = 'us-east-1', prefix = '') {
  try {
    const s3 = initS3Client(region);

    const params = {
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 1000 // Limit to 1000 photos, adjust as needed
    };

    const data = await s3.listObjectsV2(params).promise();

    if (!data.Contents || data.Contents.length === 0) {
      return [];
    }

    // Filter for image files only
    const photoKeys = data.Contents
      .filter(item => {
        const key = item.Key.toLowerCase();
        return IMAGE_EXTENSIONS.some(ext => key.endsWith(ext));
      })
      .map(item => item.Key);

    // Generate signed URLs for each photo
    const photoUrls = photoKeys.map(key => {
      return s3.getSignedUrl('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: 3600 // URL valid for 1 hour
      });
    });

    return photoUrls;
  } catch (error) {
    console.error('Error fetching photos from S3:', error);
    throw new Error(`Failed to fetch photos: ${error.message}`);
  }
}

/**
 * Fetch a single photo's signed URL
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {string} region - AWS region
 * @returns {Promise<string>} Signed URL
 */
export async function fetchPhotoUrl(bucket, key, region = 'us-east-1') {
  try {
    const s3 = initS3Client(region);

    const url = s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: 3600
    });

    return url;
  } catch (error) {
    console.error('Error fetching photo URL:', error);
    throw new Error(`Failed to fetch photo URL: ${error.message}`);
  }
}

/**
 * Fetch photos using public bucket (no authentication)
 * Use this if your S3 bucket is publicly accessible
 * @param {string} bucket - S3 bucket name
 * @param {string} region - AWS region
 * @param {string} prefix - Optional folder prefix
 * @returns {Promise<string[]>} Array of photo URLs
 */
export async function fetchPublicPhotos(bucket, region = 'us-east-1', prefix = '') {
  try {
    // Configure S3 client without credentials for public access
    const s3 = new AWS.S3({
      region: region,
      apiVersion: '2006-03-01',
      signatureVersion: 'v4'
    });

    const params = {
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 1000
    };

    const data = await s3.listObjectsV2(params).promise();

    if (!data.Contents || data.Contents.length === 0) {
      return [];
    }

    // Filter for image files and create public URLs
    const photoUrls = data.Contents
      .filter(item => {
        const key = item.Key.toLowerCase();
        return IMAGE_EXTENSIONS.some(ext => key.endsWith(ext));
      })
      .map(item => {
        // Construct public URL
        return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(item.Key)}`;
      });

    return photoUrls;
  } catch (error) {
    console.error('Error fetching public photos from S3:', error);
    throw new Error(`Failed to fetch photos: ${error.message}`);
  }
}

/**
 * Test S3 connection and permissions
 * @param {string} bucket - S3 bucket name
 * @param {string} region - AWS region
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testS3Connection(bucket, region = 'us-east-1') {
  try {
    const s3 = initS3Client(region);

    await s3.headBucket({ Bucket: bucket }).promise();
    return true;
  } catch (error) {
    console.error('S3 connection test failed:', error);
    return false;
  }
}
