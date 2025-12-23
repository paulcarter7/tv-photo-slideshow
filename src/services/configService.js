const CONFIG_KEY = 'tv-slideshow-config';
const CONFIG_VERSION = '1.0';

/**
 * Load configuration from localStorage
 * @returns {Promise<object|null>} Configuration object or null if not found
 */
export async function loadConfig() {
  try {
    const storedConfig = localStorage.getItem(CONFIG_KEY);

    if (!storedConfig) {
      return null;
    }

    const config = JSON.parse(storedConfig);

    // Check config version for migrations
    if (config.version !== CONFIG_VERSION) {
      console.warn('Config version mismatch, migrating...');
      return migrateConfig(config);
    }

    return config.data;
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
}

/**
 * Save configuration to localStorage
 * @param {object} config - Configuration object to save
 * @returns {Promise<void>}
 */
export async function saveConfig(config) {
  try {
    const configWrapper = {
      version: CONFIG_VERSION,
      data: config,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(CONFIG_KEY, JSON.stringify(configWrapper));
  } catch (error) {
    console.error('Error saving config:', error);
    throw new Error('Failed to save configuration');
  }
}

/**
 * Clear configuration from localStorage
 * @returns {Promise<void>}
 */
export async function clearConfig() {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch (error) {
    console.error('Error clearing config:', error);
    throw new Error('Failed to clear configuration');
  }
}

/**
 * Migrate configuration from older version
 * @param {object} oldConfig - Old configuration object
 * @returns {object} Migrated configuration
 */
function migrateConfig(oldConfig) {
  // Handle version migrations here
  // For now, just return the data
  return oldConfig.data || oldConfig;
}

/**
 * Export configuration as JSON file
 * @param {object} config - Configuration to export
 */
export function exportConfig(config) {
  const dataStr = JSON.stringify(config, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `tv-slideshow-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Import configuration from JSON file
 * @param {File} file - JSON file to import
 * @returns {Promise<object>} Imported configuration
 */
export async function importConfig(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        resolve(config);
      } catch (error) {
        reject(new Error('Invalid configuration file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate configuration object
 * @param {object} config - Configuration to validate
 * @returns {boolean} True if valid
 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Check required fields
  const requiredFields = ['s3Bucket', 's3Region'];
  for (const field of requiredFields) {
    if (!config[field]) {
      return false;
    }
  }

  // Validate display duration
  if (config.displayDuration && (config.displayDuration < 1 || config.displayDuration > 300)) {
    return false;
  }

  // Validate transition effect
  const validTransitions = ['fade', 'slide-transition', 'zoom'];
  if (config.transitionEffect && !validTransitions.includes(config.transitionEffect)) {
    return false;
  }

  return true;
}

/**
 * Get default configuration
 * @returns {object} Default configuration object
 */
export function getDefaultConfig() {
  return {
    s3Bucket: '',
    s3Region: 'us-east-1',
    s3Prefix: '',
    displayDuration: 10,
    transitionEffect: 'fade',
    shuffleMode: false,
    exifDisplay: {
      enabled: true,
      showDateTime: true,
      showLocation: true,
      showCameraInfo: false,
      position: 'bottom-left',
      autoHide: false,
      autoHideDelay: 5
    }
  };
}
