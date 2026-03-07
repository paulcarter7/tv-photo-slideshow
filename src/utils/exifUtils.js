import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import exifr from 'exifr';

// Cached S3 client for authenticated EXIF fetching
let cachedS3Client = null;

function getS3Client() {
  if (!cachedS3Client) {
    const region = import.meta.env.VITE_AWS_REGION || 'us-west-1';
    const identityPoolId = import.meta.env.VITE_AWS_IDENTITY_POOL_ID;
    if (!identityPoolId) return null;

    cachedS3Client = new S3Client({
      region,
      credentials: fromCognitoIdentityPool({
        identityPoolId,
        clientConfig: { region }
      })
    });
  }
  return cachedS3Client;
}

/**
 * Parse an S3 URL to extract bucket, region, and key
 */
function parseS3Url(url) {
  const match = url.match(/^https:\/\/(.+?)\.s3\.(.+?)\.amazonaws\.com\/(.+)$/);
  if (match) {
    return { bucket: match[1], region: match[2], key: decodeURIComponent(match[3]) };
  }
  return null;
}

/**
 * Fetch image data from S3 using Cognito credentials, or fall back to fetch
 */
async function fetchImageData(imageUrl) {
  const s3Info = parseS3Url(imageUrl);
  const s3Client = getS3Client();

  if (s3Info && s3Client) {
    const command = new GetObjectCommand({
      Bucket: s3Info.bucket,
      Key: s3Info.key,
    });
    const response = await s3Client.send(command);
    return new Response(response.Body).arrayBuffer();
  }

  // Fallback for non-S3 URLs
  const response = await fetch(imageUrl);
  return response.arrayBuffer();
}

/**
 * Extract EXIF data from an image URL
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<object>} Extracted EXIF data
 */
export async function extractExifData(imageUrl) {
  try {
    const buffer = await fetchImageData(imageUrl);

    // Parse EXIF data using exifr
    const exif = await exifr.parse(buffer, {
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

// Persistent location cache (survives page reloads)
const LOCATION_CACHE_KEY = 'tv-slideshow-location-cache';

function getLocationCache() {
  try {
    return JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) || '{}');
  } catch { return {}; }
}

function setLocationCache(key, value) {
  try {
    const cache = getLocationCache();
    cache[key] = value;
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full or unavailable */ }
}

// Venue types filtered out (low-value POIs)
const FILTERED_VENUE_TYPES = new Set([
  'parking', 'fuel', 'atm', 'bank', 'toilets'
]);

// Venue type priority tiers (lower = higher priority)
const VENUE_PRIORITY = new Map([
  // Tier 1 - Entertainment & dining
  ['restaurant', 1], ['bar', 1], ['cafe', 1], ['pub', 1], ['nightclub', 1],
  ['theme_park', 1], ['golf_course', 1], ['stadium', 1], ['museum', 1],
  ['zoo', 1], ['aquarium', 1], ['attraction', 1],
  // Tier 2 - Notable venues
  ['theatre', 2], ['cinema', 2], ['casino', 2], ['hotel', 2],
  ['library', 2], ['place_of_worship', 2],
  // Tier 3 - Shopping
  ['mall', 3], ['supermarket', 3], ['department_store', 3],
]);

/**
 * Select the best venue from Overpass results by priority then distance
 */
function selectBestVenue(elements, lat, lon) {
  const candidates = elements
    .filter(el => el.tags?.name && !FILTERED_VENUE_TYPES.has(el.tags.amenity))
    .map(el => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const type = el.tags.amenity || el.tags.leisure || el.tags.tourism || el.tags.shop;
      const priority = VENUE_PRIORITY.get(type) ?? 4;
      const dist = (elLat != null && elLon != null)
        ? calculateDistance(lat, lon, elLat, elLon)
        : Infinity;
      return { name: el.tags.name, priority, dist };
    });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.priority - b.priority || a.dist - b.dist);
  return candidates[0].name;
}

/**
 * Query Overpass API for nearby named venues
 */
async function getVenueName(latitude, longitude) {
  const radius = 150; // meters
  const query = `[out:json][timeout:5];(
    node["amenity"]["name"](around:${radius},${latitude},${longitude});
    way["amenity"]["name"](around:${radius},${latitude},${longitude});
    node["leisure"]["name"](around:${radius},${latitude},${longitude});
    way["leisure"]["name"](around:${radius},${latitude},${longitude});
    node["tourism"]["name"](around:${radius},${latitude},${longitude});
    way["tourism"]["name"](around:${radius},${latitude},${longitude});
    node["shop"]["name"](around:${radius},${latitude},${longitude});
    way["shop"]["name"](around:${radius},${latitude},${longitude});
  );out center;`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    return selectBestVenue(data.elements || [], latitude, longitude);
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('Overpass API query failed:', error.message);
    return null;
  }
}

/**
 * Reverse geocode coordinates to "City, State" (or "City, State, Country" for non-US)
 */
async function getNominatimLocationName(latitude, longitude) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
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
  const address = data.address || {};

  // Extract venue name from Nominatim (used as fallback if Overpass misses)
  const venueName = data.name && data.name !== address.city
    && data.name !== address.town && data.name !== address.state
    ? data.name : null;

  const cityParts = [];

  if (address.city) cityParts.push(address.city);
  else if (address.town) cityParts.push(address.town);
  else if (address.village) cityParts.push(address.village);
  else if (address.county) cityParts.push(address.county);

  if (address.state) cityParts.push(address.state);

  // Drop "United States" to keep strings concise
  if (address.country && address.country_code !== 'us') {
    cityParts.push(address.country);
  }

  const location = cityParts.length > 0 ? cityParts.join(', ') : null;

  return { location, venueName };
}

/**
 * Get location name with optional venue — runs Nominatim + Overpass in parallel
 */
async function getLocationName(latitude, longitude) {
  // Round to ~11m precision for cache key (4 decimal places)
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = getLocationCache()[cacheKey];
  if (cached) return cached;

  try {
    const [nominatimResult, venueResult] = await Promise.allSettled([
      getNominatimLocationName(latitude, longitude),
      getVenueName(latitude, longitude),
    ]);

    const nominatim = nominatimResult.status === 'fulfilled' ? nominatimResult.value : {};
    const overpassVenue = venueResult.status === 'fulfilled' ? venueResult.value : null;

    // Prefer Overpass venue, fall back to Nominatim venue name
    const venue = overpassVenue || nominatim.venueName || null;
    const location = nominatim.location || null;

    let result;
    if (venue && location) result = `${venue}, ${location}`;
    else if (venue) result = venue;
    else result = location;

    if (result) setLocationCache(cacheKey, result);
    return result;
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
