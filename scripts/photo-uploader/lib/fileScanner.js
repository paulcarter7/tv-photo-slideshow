import { readdir, stat } from 'fs/promises';
import path from 'path';

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.tiff', '.tif', '.bmp', '.raw', '.cr2', '.nef', '.arw'
]);

/**
 * Check if a file is an image based on extension
 */
export function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Get file info including size and type
 */
async function getFileInfo(filePath) {
  const stats = await stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stats.size,
    extension: ext,
    isImage: IMAGE_EXTENSIONS.has(ext)
  };
}

/**
 * Recursively scan a directory for files
 */
async function scanDirectory(dirPath, recursive = false) {
  const files = [];
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        const subFiles = await scanDirectory(fullPath, true);
        files.push(...subFiles);
      }
    } else if (entry.isFile()) {
      // Skip hidden files
      if (!entry.name.startsWith('.')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Scan paths (files or directories) and return file info
 */
export async function scanPaths(paths, options = {}) {
  const { recursive = false } = options;
  const results = {
    images: [],
    nonImages: [],
    errors: []
  };

  for (const inputPath of paths) {
    try {
      const stats = await stat(inputPath);

      if (stats.isDirectory()) {
        const files = await scanDirectory(inputPath, recursive);
        for (const filePath of files) {
          try {
            const info = await getFileInfo(filePath);
            if (info.isImage) {
              results.images.push(info);
            } else {
              results.nonImages.push(info);
            }
          } catch (err) {
            results.errors.push({ path: filePath, error: err.message });
          }
        }
      } else if (stats.isFile()) {
        const info = await getFileInfo(inputPath);
        if (info.isImage) {
          results.images.push(info);
        } else {
          results.nonImages.push(info);
        }
      }
    } catch (err) {
      results.errors.push({ path: inputPath, error: err.message });
    }
  }

  return results;
}

/**
 * Format file size for display
 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
