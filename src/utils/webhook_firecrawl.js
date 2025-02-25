// src/utils/webhook_firecrawl.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class FirecrawlWebhookHandler {
  constructor() {
    this.defaultTimeout = 30000;
  }

  async sendWebhook(url, jobData, headers = {}) {
    try {
      if (!url) {
        throw new Error('Webhook URL is required');
      }

      console.log('[FirecrawlWebhook] Preparing webhook:', { url });
      
      const payload = this._formatWebhookData(jobData);
      console.log('[FirecrawlWebhook] Sending payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: this.defaultTimeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log('[FirecrawlWebhook] Webhook sent successfully, status:', response.status);

      // Clean up job file
      try {
        const reportFile = path.join(process.cwd(), 'crawl_reports', `${jobData.id}.json`);
        await fs.unlink(reportFile);
        console.log(`[FirecrawlWebhook] Cleaned up job file: ${jobData.id}`);
      } catch (cleanupError) {
        console.error('[FirecrawlWebhook] Error cleaning up job file:', cleanupError);
      }

      return true;
    } catch (error) {
      console.error('[FirecrawlWebhook] Error sending webhook:', error.message);
      throw error;
    }
  }

  _formatWebhookData(jobData) {
    return {
      status: jobData.status === 'completed' ? 'completed' : 'failed',
      totalCount: jobData.total || 0,
      creditsUsed: jobData.processed || 0,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      data: (jobData.results || []).map(result => ({
        markdown: result.content,
        metadata: {
          title: result.metadata?.title || null,
          description: result.metadata?.description || null,
          language: result.metadata?.language || null,
          sourceURL: result.url,
          statusCode: result.success ? 200 : 500,
          error: result.error || null
        }
      }))
    };
  }
}

module.exports = new FirecrawlWebhookHandler();