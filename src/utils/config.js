// src/utils/config.js
require('dotenv').config();

class Config {
  constructor() {
    this.defaults = {
      aggressive_cleaning: true,
      remove_images: false,
      min_content_length: 500,      // New default minimum content length
      dynamic_content_timeout: 5000, // New timeout for dynamic content loading
      scroll_wait_time: 200,         // Time to wait after scrolling
      max_retries: 2                 // Default max retries for content loading
    };
  }

  // Get config value with priority: request params > env vars > defaults
  getValue(key, requestParams = {}) {
    // Convert to lowercase for consistency
    key = key.toLowerCase();

    // Check request parameters first (both camelCase and snake_case)
    if (requestParams[key] !== undefined || requestParams[this.toCamelCase(key)] !== undefined) {
      const value = requestParams[key] || requestParams[this.toCamelCase(key)];
      return this.parseValue(value, key);
    }

    // Check environment variables (uppercase with underscores)
    const envKey = key.toUpperCase();
    if (process.env[envKey] !== undefined) {
      return this.parseValue(process.env[envKey], key);
    }

    // Return default value
    return this.defaults[key];
  }

  // Helper to parse values based on expected type
  parseValue(value, key) {
    // Numeric configuration values
    const numericKeys = [
      'min_content_length', 
      'dynamic_content_timeout', 
      'scroll_wait_time', 
      'max_retries'
    ];
    
    if (numericKeys.includes(key)) {
      return parseInt(value, 10) || this.defaults[key];
    }
    
    // Boolean configuration values
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
      remove_images: this.getValue('remove_images', requestParams),
      min_content_length: this.getValue('min_content_length', requestParams),
      dynamic_content_timeout: this.getValue('dynamic_content_timeout', requestParams),
      scroll_wait_time: this.getValue('scroll_wait_time', requestParams),
      max_retries: this.getValue('max_retries', requestParams)
    };
  }
}

module.exports = new Config();