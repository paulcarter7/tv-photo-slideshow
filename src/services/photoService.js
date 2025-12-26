// Supported image formats
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

/**
 * Fetch list of photos from public S3 bucket
 * Uses simple HTTP requests to list photos from photos.json or photos.txt
 * @param {string} bucket - S3 bucket name
 * @param {string} region - AWS region
 * @param {string} prefix - Optional folder prefix
 * @returns {Promise<string[]>} Array of photo URLs
 */
export async function fetchPhotos(bucket, region = 'us-west-1', prefix = 'photos/') {
  try {
    // Try to fetch photos.json first (list of photo filenames)
    const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
    const listUrl = `${baseUrl}/${prefix}photos.json`;

    try {
      const response = await fetch(listUrl);
      if (response.ok) {
        const photoList = await response.json();
        return photoList.map(filename => `${baseUrl}/${prefix}${filename}`);
      }
    } catch (err) {
      console.log('photos.json not found, trying photos.txt...');
    }

    // Try photos.txt (one filename per line)
    const txtUrl = `${baseUrl}/${prefix}photos.txt`;
    try {
      const response = await fetch(txtUrl);
      if (response.ok) {
        const text = await response.text();
        const photoList = text.split('\n').filter(line => line.trim());
        return photoList.map(filename => `${baseUrl}/${prefix}${filename.trim()}`);
      }
    } catch (err) {
      console.log('photos.txt not found');
    }

    // If neither file exists, return hardcoded photo list
    // This is a fallback - ideally you should create photos.json or photos.txt
    console.warn('No photo list file found, using hardcoded list');
    return [
      `${baseUrl}/${prefix}Paul.jpg`,
      `${baseUrl}/${prefix}carter_party.jpg`
    ];
  } catch (error) {
    console.error('Error fetching photos from S3:', error);
    throw new Error(`Failed to fetch photos: ${error.message}`);
  }
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
    const response = await fetch(`${baseUrl}/photos/photos.txt`, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('S3 connection test failed:', error);
    return false;
  }
}
