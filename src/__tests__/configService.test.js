import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadConfig,
  saveConfig,
  clearConfig,
  validateConfig,
} from '../services/configService';

const CONFIG_KEY = 'tv-slideshow-config';

describe('configService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── loadConfig ────────────────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('returns null when nothing is stored', async () => {
      expect(await loadConfig()).toBeNull();
    });

    it('returns stored config data on a round-trip', async () => {
      const config = { s3Bucket: 'my-bucket', s3Region: 'us-east-1' };
      await saveConfig(config);
      expect(await loadConfig()).toMatchObject(config);
    });

    it('returns null when stored JSON is corrupted', async () => {
      localStorage.setItem(CONFIG_KEY, '{{not valid json');
      expect(await loadConfig()).toBeNull();
    });

    it('does not throw and returns a value when version mismatches (migration path)', async () => {
      const stale = {
        version: '0.0',
        data: { s3Bucket: 'old-bucket', s3Region: 'us-west-2' },
      };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(stale));
      const result = await loadConfig();
      // Migration should return something rather than crashing
      expect(result).not.toBeNull();
    });
  });

  // ─── saveConfig ────────────────────────────────────────────────────────────

  describe('saveConfig', () => {
    it('wraps the config with a version and timestamp', async () => {
      const config = { s3Bucket: 'my-bucket', s3Region: 'us-east-1' };
      await saveConfig(config);
      const raw = JSON.parse(localStorage.getItem(CONFIG_KEY));
      expect(raw.version).toBe('1.0');
      expect(raw.data).toMatchObject(config);
      expect(raw.savedAt).toBeDefined();
    });

    it('overwrites a previously saved config', async () => {
      await saveConfig({ s3Bucket: 'bucket-a', s3Region: 'us-east-1' });
      await saveConfig({ s3Bucket: 'bucket-b', s3Region: 'us-east-1' });
      const result = await loadConfig();
      expect(result.s3Bucket).toBe('bucket-b');
    });
  });

  // ─── clearConfig ───────────────────────────────────────────────────────────

  describe('clearConfig', () => {
    it('removes the config key from localStorage', async () => {
      await saveConfig({ s3Bucket: 'bucket', s3Region: 'us-east-1' });
      await clearConfig();
      expect(localStorage.getItem(CONFIG_KEY)).toBeNull();
    });

    it('does not throw when there is nothing to clear', async () => {
      await expect(clearConfig()).resolves.not.toThrow();
    });

    it('makes loadConfig return null after clearing', async () => {
      await saveConfig({ s3Bucket: 'bucket', s3Region: 'us-east-1' });
      await clearConfig();
      expect(await loadConfig()).toBeNull();
    });
  });

  // ─── validateConfig ────────────────────────────────────────────────────────

  describe('validateConfig', () => {
    const base = { s3Bucket: 'my-bucket', s3Region: 'us-east-1' };

    it('returns true for a minimal valid config', () => {
      expect(validateConfig(base)).toBe(true);
    });

    it('returns false for null', () => {
      expect(validateConfig(null)).toBe(false);
    });

    it('returns false for a non-object', () => {
      expect(validateConfig('string')).toBe(false);
    });

    it('returns false when s3Bucket is missing', () => {
      expect(validateConfig({ s3Region: 'us-east-1' })).toBe(false);
    });

    it('returns false when s3Region is missing', () => {
      expect(validateConfig({ s3Bucket: 'bucket' })).toBe(false);
    });

    it('returns false when displayDuration is below minimum (0)', () => {
      expect(validateConfig({ ...base, displayDuration: 0 })).toBe(false);
    });

    it('returns false when displayDuration exceeds maximum (301)', () => {
      expect(validateConfig({ ...base, displayDuration: 301 })).toBe(false);
    });

    it('accepts boundary displayDuration values (1 and 300)', () => {
      expect(validateConfig({ ...base, displayDuration: 1 })).toBe(true);
      expect(validateConfig({ ...base, displayDuration: 300 })).toBe(true);
    });

    it('returns false for an unrecognised transitionEffect', () => {
      expect(validateConfig({ ...base, transitionEffect: 'dissolve' })).toBe(false);
    });

    it('accepts every documented transition effect', () => {
      for (const effect of ['fade', 'slide-transition', 'zoom']) {
        expect(validateConfig({ ...base, transitionEffect: effect })).toBe(true);
      }
    });

    it('ignores optional fields when they are absent', () => {
      // Only required fields present
      expect(validateConfig({ s3Bucket: 'bucket', s3Region: 'us-east-1' })).toBe(true);
    });
  });
});
