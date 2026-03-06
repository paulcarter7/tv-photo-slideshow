import exifr from 'exifr';

/**
 * Validate EXIF data for a local image file
 * Requires both GPS coordinates AND date/time to be valid
 *
 * @param {string} filePath - Path to the image file
 * @returns {Promise<object>} Validation result
 */
export async function validateExif(filePath) {
  const result = {
    valid: false,
    hasGps: false,
    hasDateTime: false,
    gps: null,
    dateTime: null,
    camera: null,
    errors: []
  };

  try {
    // Parse EXIF from file (exifr can read directly from file path)
    const exif = await exifr.parse(filePath, {
      pick: [
        // DateTime tags
        'DateTimeOriginal', 'DateTime', 'CreateDate',
        // GPS tags
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
        'GPSLatitudeRef', 'GPSLongitudeRef',
        // Camera info (optional, for display)
        'Make', 'Model'
      ],
      gps: true
    });

    if (!exif) {
      result.errors.push('No EXIF data found');
      return result;
    }

    // Check GPS coordinates
    // exifr with gps:true converts to decimal latitude/longitude
    if (exif.latitude !== undefined && exif.longitude !== undefined) {
      result.hasGps = true;
      result.gps = {
        latitude: exif.latitude,
        longitude: exif.longitude,
        altitude: exif.GPSAltitude || null
      };
    } else {
      result.errors.push('Missing GPS coordinates');
    }

    // Check DateTime
    const dateTime = exif.DateTimeOriginal || exif.DateTime || exif.CreateDate;
    if (dateTime) {
      result.hasDateTime = true;
      result.dateTime = dateTime;
    } else {
      result.errors.push('Missing date/time');
    }

    // Optional camera info
    const make = exif.Make?.trim();
    const model = exif.Model?.trim();
    if (make || model) {
      result.camera = [make, model].filter(Boolean).join(' ');
    }

    // Valid only if BOTH GPS and DateTime are present
    result.valid = result.hasGps && result.hasDateTime;

    return result;
  } catch (error) {
    result.errors.push(`EXIF parsing error: ${error.message}`);
    return result;
  }
}

/**
 * Validate multiple files and categorize results
 *
 * @param {Array<object>} files - Array of file info objects from fileScanner
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {Promise<object>} Categorized validation results
 */
export async function validateFiles(files, onProgress = null) {
  const results = {
    valid: [],
    missingGps: [],
    missingDateTime: [],
    missingBoth: [],
    noExif: [],
    errors: []
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      const validation = await validateExif(file.path);

      if (validation.valid) {
        results.valid.push({ ...file, validation });
      } else if (!validation.hasGps && !validation.hasDateTime) {
        if (validation.errors.includes('No EXIF data found')) {
          results.noExif.push({ ...file, validation });
        } else {
          results.missingBoth.push({ ...file, validation });
        }
      } else if (!validation.hasGps) {
        results.missingGps.push({ ...file, validation });
      } else if (!validation.hasDateTime) {
        results.missingDateTime.push({ ...file, validation });
      }
    } catch (error) {
      results.errors.push({
        ...file,
        validation: { valid: false, errors: [error.message] }
      });
    }

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return results;
}

/**
 * Format date for display
 */
export function formatDate(date) {
  if (!date) return null;

  if (date instanceof Date) {
    return date.toLocaleString();
  }

  // Handle string dates
  try {
    return new Date(date).toLocaleString();
  } catch {
    return String(date);
  }
}

/**
 * Format GPS coordinates for display
 */
export function formatGps(gps) {
  if (!gps || gps.latitude === undefined || gps.longitude === undefined) {
    return null;
  }

  const latDir = gps.latitude >= 0 ? 'N' : 'S';
  const lonDir = gps.longitude >= 0 ? 'E' : 'W';

  return `${Math.abs(gps.latitude).toFixed(4)}° ${latDir}, ${Math.abs(gps.longitude).toFixed(4)}° ${lonDir}`;
}
