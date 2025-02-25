// src/utils/config.js
require('dotenv').config();

class Config {
  constructor() {
    this.defaults = {
      aggressive_cleaning: true,
      remove_images: false
    };
  }

  // Get config value with priority: request params > env vars > defaults
  getValue(key, requestParams = {}) {
    // Convert to lowercase for consistency
    key = key.toLowerCase();

    // Check request parameters first (both camelCase and snake_case)
    if (requestParams[key] !== undefined || requestParams[this.toCamelCase(key)] !== undefined) {
      const value = requestParams[key] || requestParams[this.toCamelCase(key)];
      return this.parseBoolean(value);
    }

    // Check environment variables (uppercase with underscores)
    const envKey = key.toUpperCase();
    if (process.env[envKey] !== undefined) {
      return this.parseBoolean(process.env[envKey]);
    }

    // Return default value
    return this.defaults[key];
  }

  // Helper to convert string to boolean
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      value = value.toLowerCase();
      return value === 'true' || value === '1' || value === 'yes';
    }
    return !!value;
  }

  // Helper to convert snake_case to camelCase
  toCamelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  // Get cleaning configuration
  getCleaningConfig(requestParams = {}) {
    return {
      aggressive_cleaning: this.getValue('aggressive_cleaning', requestParams),
      remove_images: this.getValue('remove_images', requestParams)
    };
  }
}

module.exports = new Config();