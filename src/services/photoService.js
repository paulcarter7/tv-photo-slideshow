import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Supported image formats
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

/**
 * Fetch list of photos from public S3 bucket
 * Dynamically lists all image files in the bucket
 * @param {string} bucket - S3 bucket name
 * @param {string} region - AWS region
 * @param {string} prefix - Optional folder prefix
 * @returns {Promise<string[]>} Array of photo URLs
 */
export async function fetchPhotos(bucket, region = 'us-west-1', prefix = 'photos/') {
  try {
    // Create S3 client without credentials (for public bucket)
    const s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: 'none',
        secretAccessKey: 'none'
      }
    });

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      console.warn('No files found in S3 bucket');
      return [];
    }

    // Filter for image files only and create URLs
    const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
    const photoUrls = response.Contents
      .filter(item => {
        const key = item.Key.toLowerCase();
        // Skip the prefix itself and files like photos.txt/photos.json
        return key !== prefix &&
               !key.endsWith('.txt') &&
               !key.endsWith('.json') &&
               IMAGE_EXTENSIONS.some(ext => key.endsWith(ext));
      })
      .map(item => `${baseUrl}/${item.Key}`);

    console.log(`Found ${photoUrls.length} photos in S3 bucket`);
    return photoUrls;
  } catch (error) {
    console.error('Error fetching photos from S3:', error);

    // Fallback: try to fetch from photos.txt or photos.json
    console.log('Falling back to photos.txt/photos.json...');
    return await fetchPhotosFromList(bucket, region, prefix);
  }
}

/**
 * Fallback method to fetch photos from photos.json or photos.txt
 */
async function fetchPhotosFromList(bucket, region, prefix) {
  const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;

  // Try photos.json first
  try {
    const response = await fetch(`${baseUrl}/${prefix}photos.json`);
    if (response.ok) {
      const photoList = await response.json();
      return photoList.map(filename => `${baseUrl}/${prefix}${filename}`);
    }
  } catch (err) {
    console.log('photos.json not found');
  }

  // Try photos.txt
  try {
    const response = await fetch(`${baseUrl}/${prefix}photos.txt`);
    if (response.ok) {
      const text = await response.text();
      const photoList = text.split('\n').filter(line => line.trim());
      return photoList.map(filename => `${baseUrl}/${prefix}${filename.trim()}`);
    }
  } catch (err) {
    console.log('photos.txt not found');
  }

  // Last resort: hardcoded list
  console.warn('No photo list file found, using hardcoded list');
  return [
    `${baseUrl}/${prefix}Paul.jpg`,
    `${baseUrl}/${prefix}carter_party.jpg`
  ];
}

/**
 * Test S3 connection by trying to fetch a photo
 * @param {string} bucket - S3 bucket name
 * @param {string} region - AWS region
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testS3Connection(bucket, region = 'us-west-1') {
  try {
    const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
    const response = await fetch(`${baseUrl}/photos/`, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('S3 connection test failed:', error);
    return false;
  }
}
