// Mock photo service for local development
// Uses sample images from public folder or placeholder services

/**
 * Fetch mock photos for local testing
 * @returns {Promise<string[]>} Array of photo URLs
 */
export async function fetchPhotos() {
  // Option 1: Use placeholder images from picsum.photos
  const mockPhotos = [
    'https://picsum.photos/1920/1080?random=1',
    'https://picsum.photos/1920/1080?random=2',
    'https://picsum.photos/1920/1080?random=3',
    'https://picsum.photos/1920/1080?random=4',
    'https://picsum.photos/1920/1080?random=5',
    'https://picsum.photos/1920/1080?random=6',
    'https://picsum.photos/1920/1080?random=7',
    'https://picsum.photos/1920/1080?random=8',
  ];

  // Option 2: If you put images in public/photos/, use local URLs
  // const mockPhotos = [
  //   '/photos/photo1.jpg',
  //   '/photos/photo2.jpg',
  //   '/photos/photo3.jpg',
  // ];

  // Simulate async fetch
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockPhotos), 500);
  });
}

export async function testS3Connection() {
  return true;
}
