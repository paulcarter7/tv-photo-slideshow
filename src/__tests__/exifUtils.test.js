import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AWS + exifr so tests never touch the network or real credentials.
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  GetObjectCommand: vi.fn(),
}));
vi.mock('@aws-sdk/credential-providers', () => ({
  fromCognitoIdentityPool: vi.fn().mockReturnValue({}),
}));
vi.mock('exifr', () => ({
  default: { parse: vi.fn() },
}));

import {
  extractExifData,
  formatCoordinatesDMS,
  calculateDistance,
  groupPhotosByLocation,
} from '../utils/exifUtils';
import exifr from 'exifr';

// ─── formatCoordinatesDMS ─────────────────────────────────────────────────────

describe('formatCoordinatesDMS', () => {
  it('formats a positive latitude as North', () => {
    expect(formatCoordinatesDMS(40.7128, true)).toMatch(/N$/);
  });

  it('formats a negative latitude as South', () => {
    expect(formatCoordinatesDMS(-33.8688, true)).toMatch(/S$/);
  });

  it('formats a positive longitude as East', () => {
    expect(formatCoordinatesDMS(151.2093, false)).toMatch(/E$/);
  });

  it('formats a negative longitude as West', () => {
    expect(formatCoordinatesDMS(-74.006, false)).toMatch(/W$/);
  });

  it('formats zero as North / East (neither negative)', () => {
    expect(formatCoordinatesDMS(0, true)).toMatch(/0° 0' 0\.00" N/);
    expect(formatCoordinatesDMS(0, false)).toMatch(/0° 0' 0\.00" E/);
  });

  it('correctly converts 1.5° to 1° 30′ 0.00″', () => {
    // 1.5 decimal degrees = 1° 30' 0.00"
    expect(formatCoordinatesDMS(1.5, true)).toMatch(/1° 30' 0\.00" N/);
  });

  it('extracts the correct degree value from the string', () => {
    const result = formatCoordinatesDMS(40.7128, true);
    expect(result).toContain('40°');
  });
});

// ─── calculateDistance ────────────────────────────────────────────────────────

describe('calculateDistance', () => {
  it('returns 0 for the same point', () => {
    expect(calculateDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('is symmetric — dist(A,B) equals dist(B,A)', () => {
    const d1 = calculateDistance(40.7128, -74.006, 51.5074, -0.1278);
    const d2 = calculateDistance(51.5074, -0.1278, 40.7128, -74.006);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('returns a plausible distance between New York and London (~5570 km)', () => {
    const dist = calculateDistance(40.7128, -74.006, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(5500);
    expect(dist).toBeLessThan(5650);
  });

  it('returns a small distance (~111 m) for points 0.001° of latitude apart', () => {
    // 1° latitude ≈ 111 km, so 0.001° ≈ 0.111 km
    const dist = calculateDistance(40.0, -74.0, 40.001, -74.0);
    expect(dist).toBeCloseTo(0.111, 2);
  });
});

// ─── groupPhotosByLocation ────────────────────────────────────────────────────

describe('groupPhotosByLocation', () => {
  const withGps = (lat, lon) => ({
    url: `photo_${lat}_${lon}.jpg`,
    exif: { latitude: lat, longitude: lon },
  });
  const withoutGps = { url: 'no-gps.jpg', exif: {} };

  it('returns an empty array for empty input', () => {
    expect(groupPhotosByLocation([])).toEqual([]);
  });

  it('excludes photos with no GPS data', () => {
    const photos = [
      withoutGps,
      { url: 'also-no-gps.jpg', exif: { latitude: null, longitude: null } },
    ];
    expect(groupPhotosByLocation(photos)).toHaveLength(0);
  });

  it('creates one group for a single geotagged photo', () => {
    const groups = groupPhotosByLocation([withGps(40.7128, -74.006)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos).toHaveLength(1);
  });

  it('groups two photos within the default 1 km radius together', () => {
    // 0.001° latitude ≈ 111 m — well inside 1 km
    const photos = [withGps(40.7128, -74.006), withGps(40.7138, -74.006)];
    const groups = groupPhotosByLocation(photos);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos).toHaveLength(2);
  });

  it('puts photos more than 1 km apart into separate groups', () => {
    // New York and Los Angeles — ~3940 km apart
    const photos = [withGps(40.7128, -74.006), withGps(34.0522, -118.2437)];
    expect(groupPhotosByLocation(photos, 1)).toHaveLength(2);
  });

  it('respects a custom radius', () => {
    // NYC (40.71, -74.01) and Princeton (40.36, -74.67) are ~70 km apart
    const photos = [withGps(40.7128, -74.006), withGps(40.3573, -74.6672)];
    expect(groupPhotosByLocation(photos, 100)).toHaveLength(1); // inside 100 km
    expect(groupPhotosByLocation(photos, 50)).toHaveLength(2);  // outside 50 km
  });

  it('handles a mix of geotagged and non-geotagged photos', () => {
    const photos = [withGps(40.7128, -74.006), withoutGps, withGps(34.0522, -118.2437)];
    const groups = groupPhotosByLocation(photos);
    expect(groups).toHaveLength(2);
    const total = groups.reduce((n, g) => n + g.photos.length, 0);
    expect(total).toBe(2); // non-GPS photo is excluded
  });
});

// ─── extractExifData ──────────────────────────────────────────────────────────
//
// VITE_AWS_IDENTITY_POOL_ID is intentionally not stubbed here so that
// getS3Client() returns null, forcing all image fetches through global.fetch.

describe('extractExifData', () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: image fetch succeeds with an empty buffer
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
  });

  it('returns null when exifr finds no metadata in the image', async () => {
    exifr.parse.mockResolvedValue(null);
    expect(await extractExifData('https://example.com/photo.jpg')).toBeNull();
  });

  it('returns null when the image fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    expect(await extractExifData('https://example.com/photo.jpg')).toBeNull();
  });

  it('extracts camera make and model (trimming whitespace)', async () => {
    exifr.parse.mockResolvedValue({ Make: 'Canon  ', Model: 'EOS R5' });
    const result = await extractExifData('https://example.com/photo.jpg');
    expect(result.make).toBe('Canon');
    expect(result.model).toBe('EOS R5');
  });

  it('extracts exposure settings', async () => {
    exifr.parse.mockResolvedValue({ FNumber: 2.8, ISO: 400, FocalLength: 50 });
    const result = await extractExifData('https://example.com/photo.jpg');
    expect(result.fNumber).toBe(2.8);
    expect(result.iso).toBe(400);
    expect(result.focalLength).toBe(50);
  });

  it('formats fast shutter speeds as a fraction (e.g. 1/250)', async () => {
    exifr.parse.mockResolvedValue({ ExposureTime: 1 / 250 });
    const result = await extractExifData('https://example.com/photo.jpg');
    expect(result.exposureTime).toBe('1/250');
  });

  it('formats slow shutter speeds as a decimal (e.g. 2.5)', async () => {
    exifr.parse.mockResolvedValue({ ExposureTime: 2.5 });
    const result = await extractExifData('https://example.com/photo.jpg');
    expect(result.exposureTime).toBe('2.5');
  });

  it('leaves exposureTime null when ExposureTime is absent', async () => {
    exifr.parse.mockResolvedValue({ Make: 'Sony' });
    const result = await extractExifData('https://example.com/photo.jpg');
    expect(result.exposureTime).toBeNull();
  });

  it('fetches a location name when GPS coordinates are present', async () => {
    exifr.parse.mockResolvedValue({ latitude: 40.7128, longitude: -74.006 });

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === 'https://example.com/photo.jpg') {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        });
      }
      if (url.includes('nominatim.openstreetmap.org')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              address: { city: 'New York', state: 'NY', country_code: 'us' },
            }),
        });
      }
      // Overpass
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      });
    });

    const result = await extractExifData('https://example.com/photo.jpg');
    expect(result.locationName).toContain('New York');
  });

  it('caches location lookups so the same coordinates skip geocoding on repeat calls', async () => {
    exifr.parse.mockResolvedValue({ latitude: 40.7128, longitude: -74.006 });

    let nominatimCallCount = 0;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === 'https://example.com/photo.jpg') {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        });
      }
      if (url.includes('nominatim.openstreetmap.org')) {
        nominatimCallCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              address: { city: 'New York', state: 'NY', country_code: 'us' },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ elements: [] }) });
    });

    await extractExifData('https://example.com/photo.jpg');
    await extractExifData('https://example.com/photo.jpg');

    expect(nominatimCallCount).toBe(1); // second call must use the cache
  });

  it('sets locationName to null when geocoding fails', async () => {
    exifr.parse.mockResolvedValue({ latitude: 40.7128, longitude: -74.006 });

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === 'https://example.com/photo.jpg') {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        });
      }
      // Both geocoding calls fail
      return Promise.reject(new Error('geocoding unavailable'));
    });

    const result = await extractExifData('https://example.com/photo.jpg');
    expect(result).not.toBeNull();
    expect(result.locationName).toBeNull();
  });
});
