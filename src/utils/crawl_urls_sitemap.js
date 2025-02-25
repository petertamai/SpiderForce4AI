// src/utils/crawl_urls_sitemap.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const browserManager = require('./browser-manager');
const { cleanContent } = require('./cleaner.js');
const { convertToMarkdown } = require('./converter.js');
const { extractMetadata, formatMetadata } = require('./metadata');

class CrawlerHandler {
  constructor() {
    this.jobs = new Map();
    this.parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true
    });
    this.delayBetweenRequests = 5; // miliseconds between requests
    this.reportsDir = path.join(process.cwd(), 'crawl_reports');
    this.ensureReportDirectory();
  }

  async ensureReportDirectory() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating reports directory:', error);
    }
  }

  async crawlSitemap(sitemapUrl) {
    try {
      const response = await axios.get(sitemapUrl, {
        headers: {
          'User-Agent': 'SpiderForce4AI/1.0',
          'Accept': 'application/xml,text/xml,*/*'
        },
        timeout: 30000
      });
      
      const parsed = this.parser.parse(response.data);
      let urls = [];
      
      if (parsed.urlset?.url) {
        urls = Array.isArray(parsed.urlset.url) 
          ? parsed.urlset.url.map(u => u.loc || u)
          : [parsed.urlset.url.loc || parsed.urlset.url];
      }

      return urls.filter(url => {
        try {
          new URL(url);
          return true;
        } catch (e) {
          return false;
        }
      });
    } catch (error) {
      console.error('Sitemap fetch error:', error);
      throw error;
    }
  }

  async processUrl(url, config) {
    let page = null;
    try {
      page = await browserManager.createPage();
      await page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });

      const metadata = await extractMetadata(page);
      const formattedMetadata = formatMetadata(metadata);
      const cleanedHtml = await cleanContent(page, config);
      const markdown = await convertToMarkdown(cleanedHtml);
      console.log('\x1b[32m%s\x1b[0m', `✅ Successfully converted: ${url}`);
      return {
        url,
        success: true,
        metadata: formattedMetadata,
        content: markdown,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        url,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      if (page) await browserManager.closePage(page);
    }
  }

  async createJob(config) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = {
      id: jobId,
      status: 'pending',
      config: {
        ...config,
        targetSelectors: config.targetSelectors || [],
        removeSelectors: config.removeSelectors || []
      },
      results: [],
      startTime: Date.now(),
      processed: 0,
      total: 0,
      reportFile: path.join(this.reportsDir, `${jobId}.json`)
    };

    this.jobs.set(jobId, job);
    this.processJob(jobId);

    return {
      jobId,
      status: 'started',
      config: {
        sitemapUrl: config.sitemapUrl,
        urls: config.urls,
        targetSelectors: job.config.targetSelectors,
        removeSelectors: job.config.removeSelectors,
        webhook: config.webhook ? {
          url: config.webhook.url,
          hasHeaders: !!config.webhook.headers
        } : null
      }
    };
  }

  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      const urls = job.config.sitemapUrl 
        ? await this.crawlSitemap(job.config.sitemapUrl)
        : job.config.urls;

      if (!urls?.length) {
        throw new Error('No valid URLs found');
      }

      job.total = urls.length;
      await this.saveJobState(job);

      for (const url of urls) {
        const result = await this.processUrl(url, job.config);
        job.results.push(result);
        job.processed++;
        await this.saveJobState(job);
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenRequests));
      }

      job.status = 'completed';
      job.endTime = Date.now();
      await this.saveJobState(job);

      // Send final webhook if configured
      if (job.config.webhook) {
        await this.sendWebhook(job);
      }
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      await this.saveJobState(job);
      console.error(`Job ${jobId} failed:`, error);
    }
  }

  async saveJobState(job) {
    try {
      const state = {
        id: job.id,
        status: job.status,
        startTime: job.startTime,
        endTime: job.endTime,
        config: {
          sitemapUrl: job.config.sitemapUrl,
          targetSelectors: job.config.targetSelectors,
          removeSelectors: job.config.removeSelectors
        },
        summary: {
          total: job.total,
          processed: job.processed,
          successful: job.results.filter(r => r.success).length,
          failed: job.results.filter(r => !r.success).length,
          processingTime: job.endTime ? (job.endTime - job.startTime) : null
        },
        results: job.results,
        error: job.error
      };

      await fs.writeFile(job.reportFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error(`Error saving job state for ${job.id}:`, error);
    }
  }

  async sendWebhook(job) {
    try {
      console.log(`[Job ${job.id}] Sending webhook`);

      // Check if it's a custom sendWebhook function (Firecrawl or other custom)
      if (job.config.webhook.sendWebhook) {
        console.log(`[Job ${job.id}] Using custom webhook handler`);
        await job.config.webhook.sendWebhook(job);
        return;
      }

      // Original webhook handling
      const payload = {
        timestamp: new Date().toISOString(),
        config: job.config,
        status: job.status,
        summary: {
          total: job.total,
          successful: job.results.filter(r => r.success).length,
          failed: job.results.filter(r => !r.success).length,
          processingTime: job.endTime - job.startTime
        },
        results: {
          successful: job.results.filter(r => r.success).map(result => ({
            url: result.url,
            status: "success",
            markdown: result.content,
            error: null,
            timestamp: result.timestamp,
            config: job.config,
            metadata: result.metadata
          })),
          failed: job.results.filter(r => !r.success).map(result => ({
            url: result.url,
            status: "failed",
            markdown: null,
            error: result.error,
            timestamp: result.timestamp,
            config: job.config
          }))
        }
      };

      if (job.config.webhook.extraFields) {
        Object.assign(payload, job.config.webhook.extraFields);
      }

      // Send webhook
      await axios.post(job.config.webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(job.config.webhook.headers || {})
        },
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log(`[Job ${job.id}] Webhook sent successfully`);

      // Clean up after successful webhook delivery
      try {
        // Remove the job file if it exists
        if (job.reportFile) {
          await fs.unlink(job.reportFile);
        }
        // Remove from memory
        this.jobs.delete(job.id);
        console.log(`[Job ${job.id}] Cleaned up`);
      } catch (cleanupError) {
        console.error(`[Job ${job.id}] Error during cleanup:`, cleanupError);
      }

    } catch (error) {
      console.error(`[Job ${job.id}] Webhook error:`, error.message);
      throw error;
    }
  }
  // Also add a cleanup method for manual cleanup if needed
  async cleanupJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      try {
        if (job.reportFile) {
          await fs.unlink(job.reportFile);
        }
        this.jobs.delete(jobId);
        console.log(`Manually cleaned up job ${jobId}`);
      } catch (error) {
        console.error(`Error cleaning up job ${jobId}:`, error);
      }
    }
  }
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      try {
        // Try to read from file
        const reportFile = path.join(this.reportsDir, `${jobId}.json`);
        const data = require(reportFile);
        return data;
      } catch (error) {
        return { status: 'not_found' };
      }
    }

    return {
      id: job.id,
      status: job.status,
      config: {
        sitemapUrl: job.config.sitemapUrl,
        targetSelectors: job.config.targetSelectors,
        removeSelectors: job.config.removeSelectors
      },
      summary: {
        total: job.total,
        processed: job.processed,
        successful: job.results.filter(r => r.success).length,
        failed: job.results.filter(r => !r.success).length,
        processingTime: job.endTime ? (job.endTime - job.startTime) : null
      },
      results: job.results,
      error: job.error,
      reportFile: job.reportFile
    };
  }
  async getJobResults(jobId) {
    try {
      const reportFile = path.join(this.reportsDir, `${jobId}.json`);
      const data = await fs.readFile(reportFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading results for job ${jobId}:`, error);
      return null;
    }
  }
}

module.exports = new CrawlerHandler();