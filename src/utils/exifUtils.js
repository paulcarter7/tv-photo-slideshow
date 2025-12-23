import exifr from 'exifr';

/**
 * Extract EXIF data from an image URL
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<object>} Extracted EXIF data
 */
export async function extractExifData(imageUrl) {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    // Parse EXIF data using exifr
    const exif = await exifr.parse(blob, {
      // Specify which tags to extract for better performance
      pick: [
        // DateTime tags
        'DateTimeOriginal', 'DateTime', 'CreateDate',
        // GPS tags
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
        'GPSLatitudeRef', 'GPSLongitudeRef',
        // Camera info
        'Make', 'Model', 'LensModel',
        // Exposure settings
        'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
        'FocalLengthIn35mmFormat',
        // Image info
        'ImageWidth', 'ImageHeight', 'Orientation'
      ],
      // Enable GPS parsing
      gps: true,
      // Enable XMP parsing for additional metadata
      xmp: true,
      // Enable IPTC for location names
      iptc: true
    });

    if (!exif) {
      return null;
    }

    // Format the extracted data
    const formattedData = {
      // DateTime
      dateTime: exif.DateTimeOriginal || exif.DateTime || exif.CreateDate || null,

      // GPS coordinates (already converted to decimal by exifr)
      latitude: exif.latitude || null,
      longitude: exif.longitude || null,
      altitude: exif.GPSAltitude || null,

      // Camera information
      make: exif.Make?.trim() || null,
      model: exif.Model?.trim() || null,
      lensModel: exif.LensModel?.trim() || null,

      // Exposure settings
      fNumber: exif.FNumber || null,
      exposureTime: formatExposureTime(exif.ExposureTime) || null,
      iso: exif.ISO || null,
      focalLength: exif.FocalLength || exif.FocalLengthIn35mmFormat || null,

      // Image dimensions
      width: exif.ImageWidth || null,
      height: exif.ImageHeight || null,
      orientation: exif.Orientation || null
    };

    // Try to get location name from GPS coordinates
    if (formattedData.latitude && formattedData.longitude) {
      try {
        const locationName = await getLocationName(
          formattedData.latitude,
          formattedData.longitude
        );
        formattedData.locationName = locationName;
      } catch (error) {
        console.warn('Could not fetch location name:', error);
        formattedData.locationName = null;
      }
    }

    return formattedData;
  } catch (error) {
    console.error('Error extracting EXIF data:', error);
    return null;
  }
}

/**
 * Format exposure time to a readable string
 * @param {number} exposureTime - Exposure time in seconds
 * @returns {string} Formatted exposure time
 */
function formatExposureTime(exposureTime) {
  if (!exposureTime) return null;

  if (exposureTime >= 1) {
    return `${exposureTime.toFixed(1)}`;
  }

  // Convert to fraction for fast shutter speeds
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}`;
}

/**
 * Convert GPS coordinates to location name using reverse geocoding
 * Note: This requires a geocoding service. Using OpenStreetMap Nominatim as example.
 * For production, consider using a paid service with better rate limits.
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<string>} Location name
 */
async function getLocationName(latitude, longitude) {
  try {
    // Use OpenStreetMap Nominatim for reverse geocoding (free, but rate-limited)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TV-Photo-Slideshow-App'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();

    // Extract meaningful location name
    const address = data.address || {};
    const parts = [];

    // Prefer city/town/village
    if (address.city) parts.push(address.city);
    else if (address.town) parts.push(address.town);
    else if (address.village) parts.push(address.village);
    else if (address.county) parts.push(address.county);

    // Add state/region if available
    if (address.state) parts.push(address.state);

    // Add country
    if (address.country) parts.push(address.country);

    return parts.length > 0 ? parts.join(', ') : null;
  } catch (error) {
    console.error('Error getting location name:', error);
    return null;
  }
}

/**
 * Convert decimal coordinates to DMS (Degrees, Minutes, Seconds) format
 * @param {number} decimal - Decimal coordinate
 * @param {boolean} isLatitude - True if latitude, false if longitude
 * @returns {string} DMS formatted coordinate
 */
export function formatCoordinatesDMS(decimal, isLatitude) {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);

  const direction = isLatitude
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Degrees
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Group photos by location (within a certain radius)
 * @param {Array} photos - Array of photos with EXIF data
 * @param {number} radiusKm - Radius in kilometers to group by
 * @returns {Array} Array of photo groups
 */
export function groupPhotosByLocation(photos, radiusKm = 1) {
  const groups = [];

  photos.forEach(photo => {
    if (!photo.exif?.latitude || !photo.exif?.longitude) {
      return;
    }

    // Find existing group within radius
    let foundGroup = false;
    for (const group of groups) {
      const distance = calculateDistance(
        photo.exif.latitude,
        photo.exif.longitude,
        group.latitude,
        group.longitude
      );

      if (distance <= radiusKm) {
        group.photos.push(photo);
        foundGroup = true;
        break;
      }
    }

    // Create new group if no nearby group found
    if (!foundGroup) {
      groups.push({
        latitude: photo.exif.latitude,
        longitude: photo.exif.longitude,
        locationName: photo.exif.locationName,
        photos: [photo]
      });
    }
  });

  return groups;
}
