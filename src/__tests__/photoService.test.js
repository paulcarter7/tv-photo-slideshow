import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// vi.hoisted lets us reference mockSend inside the vi.mock factory below,
// even though vi.mock is hoisted to the top of the file.
const mockSend = vi.hoisted(() => vi.fn());

// Vitest 4 requires constructor mocks to use `function` (not arrow) syntax.
vi.mock('@aws-sdk/client-s3', () => ({
  // eslint-disable-next-line prefer-arrow-callback
  S3Client: vi.fn().mockImplementation(function () {
    this.send = mockSend;
  }),
  ListObjectsV2Command: vi.fn().mockImplementation(function (input) {
    Object.assign(this, input);
  }),
}));

vi.mock('@aws-sdk/credential-providers', () => ({
  fromCognitoIdentityPool: vi.fn().mockReturnValue({}),
}));

import { fetchPhotos } from '../services/photoService';

describe('photoService', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AWS_IDENTITY_POOL_ID', 'us-east-1:test-pool-id');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── fetchPhotos — S3 listing ───────────────────────────────────────────────

  describe('fetchPhotos (S3 listing)', () => {
    it('returns image URLs built from the S3 bucket and region', async () => {
      mockSend.mockResolvedValue({
        Contents: [{ Key: 'photos/dog.jpg' }],
      });

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos).toHaveLength(1);
      expect(photos[0]).toBe(
        'https://test-bucket.s3.us-east-1.amazonaws.com/photos/dog.jpg'
      );
    });

    it('returns all supported image formats (jpg, jpeg, png, gif, webp)', async () => {
      mockSend.mockResolvedValue({
        Contents: [
          { Key: 'photos/a.jpg' },
          { Key: 'photos/b.jpeg' },
          { Key: 'photos/c.png' },
          { Key: 'photos/d.gif' },
          { Key: 'photos/e.webp' },
        ],
      });

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos).toHaveLength(5);
    });

    it('excludes the prefix key itself, .txt, .json, and non-image files', async () => {
      mockSend.mockResolvedValue({
        Contents: [
          { Key: 'photos/' },           // prefix directory entry
          { Key: 'photos/photos.txt' }, // manifest file
          { Key: 'photos/photos.json' },
          { Key: 'photos/readme.md' },
          { Key: 'photos/real.jpg' },   // only this should survive
        ],
      });

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos).toHaveLength(1);
      expect(photos[0]).toContain('real.jpg');
    });

    it('returns an empty array when Contents is an empty list', async () => {
      mockSend.mockResolvedValue({ Contents: [] });
      expect(await fetchPhotos('test-bucket', 'us-east-1', 'photos/')).toEqual([]);
    });

    it('returns an empty array when Contents is absent from the response', async () => {
      mockSend.mockResolvedValue({});
      expect(await fetchPhotos('test-bucket', 'us-east-1', 'photos/')).toEqual([]);
    });
  });

  // ─── fetchPhotos — fallback chain ──────────────────────────────────────────
  //
  // When ListObjectsV2 fails (e.g. permission denied), the service tries:
  //   1. photos.json  →  2. photos.txt  →  3. hardcoded list
  //
  // This chain is the only recovery path, so it must be airtight.

  describe('fetchPhotos (fallback chain on S3 error)', () => {
    beforeEach(() => {
      mockSend.mockRejectedValue(new Error('AccessDenied'));
    });

    it('falls back to photos.json and maps filenames to full URLs', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(['beach.jpg', 'mountain.jpg']),
      });

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos).toHaveLength(2);
      expect(photos[0]).toContain('beach.jpg');
      expect(photos[0]).toMatch(/^https:\/\/test-bucket\.s3\.us-east-1\.amazonaws\.com/);
    });

    it('falls back to photos.txt when photos.json returns 404', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false })           // photos.json → 404
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('beach.jpg\nmountain.jpg\n'),
        });

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos).toHaveLength(2);
      expect(photos[0]).toContain('beach.jpg');
    });

    it('ignores blank lines in photos.txt', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('a.jpg\n\nb.jpg\n'),
        });

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos).toHaveLength(2);
    });

    it('falls back to the hardcoded list when both manifest files fail', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false }) // photos.json
        .mockResolvedValueOnce({ ok: false }); // photos.txt

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos.length).toBeGreaterThan(0);
      expect(photos.every((url) => url.startsWith('https://'))).toBe(true);
    });

    it('falls back to the hardcoded list when fetch itself throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const photos = await fetchPhotos('test-bucket', 'us-east-1', 'photos/');
      expect(photos.length).toBeGreaterThan(0);
    });
  });
});
