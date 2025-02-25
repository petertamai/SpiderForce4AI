// src/utils/webhook-handler.js
const axios = require('axios');

class WebhookHandler {
  constructor() {
    this.defaultTimeout = 10000; // 10 seconds
  }

  /**
   * Process and send webhook
   */
  async sendWebhook(webhookConfig, conversionData) {
    try {
      if (!webhookConfig || !webhookConfig.url) {
        return { success: false, error: 'No webhook configuration provided' };
      }

      console.log(`[Webhook] Preparing webhook for ${webhookConfig.url}`);

      // Prepare request configuration
      const config = this._prepareRequestConfig(webhookConfig);

      // Prepare payload with variable replacement
      const payload = this._preparePayload(webhookConfig.data || {}, conversionData);

      // Send webhook
      console.log('[Webhook] Sending webhook request');
      const response = await axios(config.url, {
        method: config.method,
        headers: config.headers,
        data: payload,
        timeout: config.timeout
      });

      console.log(`[Webhook] Webhook sent successfully. Status: ${response.status}`);
      return {
        success: true,
        status: response.status,
        statusText: response.statusText
      };

    } catch (error) {
      console.error('[Webhook] Error sending webhook:', error);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Prepare request configuration
   */
  _prepareRequestConfig(webhookConfig) {
    return {
      url: webhookConfig.url,
      method: webhookConfig.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...webhookConfig.headers
      },
      timeout: webhookConfig.timeout || this.defaultTimeout
    };
  }

  /**
   * Prepare payload with variable replacement
   */
  _preparePayload(template, conversionData) {
    const { url, markdown, metadata, options } = conversionData;

    // Create base payload with conversion data
    const basePayload = {
      original_url: url,
      converted_at: new Date().toISOString(),
      metadata,
      options,
      markdown
    };

    // If no template provided, return base payload
    if (Object.keys(template).length === 0) {
      return basePayload;
    }

    // Process template and replace variables
    const processValue = (value) => {
      if (typeof value !== 'string') return value;
      
      // Replace markdown variable
      return value.replace(/##markdown##/g, markdown)
        // Add other variable replacements here
        .replace(/##url##/g, url)
        .replace(/##timestamp##/g, new Date().toISOString())
        .replace(/##metadata##/g, JSON.stringify(metadata))
        .replace(/##options##/g, JSON.stringify(options));
    };

    // Recursively process template object
    const processTemplate = (obj) => {
      const result = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          result[key] = processTemplate(value);
        } else {
          result[key] = processValue(value);
        }
      }
      
      return result;
    };

    // Merge processed template with base payload
    return {
      ...basePayload,
      ...processTemplate(template)
    };
  }
}

module.exports = new WebhookHandler();