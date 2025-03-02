// src/utils/firecrawl.js - Enhanced with concurrent crawling
const browserManager = require('./browser-manager');
const { cleanContent } = require('./cleaner.js');
const { convertToMarkdown } = require('./converter.js');
const { extractMetadata } = require('./metadata');
const crawlerHandler = require('./crawl_urls_sitemap');
const firecrawlWebhook = require('./webhook_firecrawl');
const concurrentCrawler = require('./concurrent-crawler');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

// Pre-initialize browser
browserManager.getBrowser().then(() => {
    console.log('Browser pre-initialized and ready');
  }).catch(error => {
    console.error('Failed to pre-initialize browser:', error);
  });
  
class FirecrawlAdapter {
  constructor() {
    this.defaultTimeout = 30000;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true
    });
  }

  handleScrape = async (req) => {
    const { url, formats = ['markdown'], onlyMainContent = true } = req.body;
    let page = null;

    try {
      page = await browserManager.createPage();
      await browserManager.navigateToUrl(page, url);

      const metadata = await extractMetadata(page);
      const options = {
        targetSelectors: onlyMainContent ? ['article', '.main-content', '#content'] : [],
        removeSelectors: []
      };

      const cleanedHtml = await cleanContent(page, options);
      const markdown = await convertToMarkdown(cleanedHtml);

      return {
        success: true,
        data: {
          markdown: markdown,
          metadata: {
            title: metadata.title || null,
            description: metadata.description || null,
            language: metadata.language || null,
            sourceURL: url
          }
        }
      };

    } catch (error) {
      console.error('Scrape error:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (page) {
        await browserManager.closePage(page).catch(console.error);
      }
    }
  }

  handleCrawl = async (config) => {
    const { url, limit = 100, webhook, scrapeOptions = {}, jobId } = config;
    
    try {
      let urls = [];
      
      if (url.toLowerCase().includes('sitemap')) {
        // Use the concurrent crawler for better sitemap handling
        urls = await concurrentCrawler.fetchSitemapUrls(url);
      } else {
        urls = await this._discoverLinks(url, true);
      }

      urls = urls.slice(0, limit);

      // Configure webhook handler for Firecrawl format
      const webhookConfig = webhook ? {
        url: typeof webhook === 'string' ? webhook : webhook.url,
        headers: webhook.headers || {},
        progressUpdates: true, // Enable progress updates
        sendWebhook: async (job) => {
          console.log('[Firecrawl] Sending webhook for job:', job.id);
          return await firecrawlWebhook.sendWebhook(
            webhookConfig.url,
            job,
            webhookConfig.headers
          );
        }
      } : null;

      // Enhanced job configuration with concurrency
      const jobConfig = {
        urls,
        targetSelectors: ['.main-content', 'article', '#content'],
        removeSelectors: ['.ads', '.nav', '.footer', '.header'],
        webhook: webhookConfig,
        formats: scrapeOptions.formats || ['markdown'],
        maxConcurrent: scrapeOptions.maxConcurrent || 5,
        batchSize: scrapeOptions.batchSize || 10,
        processingDelay: scrapeOptions.processingDelay || 100
      };

      console.log('[Firecrawl] Creating job with webhook:', webhookConfig?.url);
      
      // Use the concurrent crawler instead of the old crawler handler
      const result = await concurrentCrawler.createJob({
        ...jobConfig,
        id: jobId
      });

      return {
        success: true,
        id: result.jobId,
        url: `/v1/crawl/${result.jobId}`
      };

    } catch (error) {
      console.error('Crawl error:', error);
      throw error;
    }
  }

  _fetchSitemapUrls = async (sitemapUrl) => {
    // Use the concurrent crawler for better sitemap handling
    return await concurrentCrawler.fetchSitemapUrls(sitemapUrl);
  }

  _discoverLinks = async (url, includeSubdomains) => {
    let page = null;
    try {
      page = await browserManager.createPage();
      await browserManager.navigateToUrl(page, url);

      const links = await page.evaluate((includeSubs) => {
        const collected = new Set();

        const shouldInclude = (href) => {
          try {
            const url = new URL(href);
            return includeSubs ? url.hostname.includes(window.location.hostname) 
                             : url.hostname === window.location.hostname;
          } catch {
            return false;
          }
        };

        document.querySelectorAll('a[href]').forEach(link => {
          const href = link.href;
          if (href && shouldInclude(href)) {
            collected.add(href);
          }
        });

        return Array.from(collected);
      }, includeSubdomains);

      return links;

    } catch (error) {
      console.error('Link discovery error:', error);
      throw error;
    } finally {
      if (page) {
        await browserManager.closePage(page).catch(console.error);
      }
    }
  }

  getCrawlStatus = async (jobId) => {
    try {
      // Get job status from concurrent crawler
      const status = concurrentCrawler.getJobStatus(jobId);

      if (status.status === 'not_found') {
        throw new Error('Job not found');
      }

      const CHUNK_SIZE = 10;
      const skip = Number(status.skip || 0);
      const hasMore = (status.summary.total - skip) > CHUNK_SIZE;

      return {
        status: this._mapStatus(status.status),
        total: status.summary.total,
        completed: status.summary.processed,
        creditsUsed: status.summary.processed,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        next: hasMore ? `/v1/crawl/${jobId}?skip=${skip + CHUNK_SIZE}` : null,
        data: status.status === 'completed' ? status.results.slice(skip, skip + CHUNK_SIZE).map(result => ({
          markdown: result.content,
          metadata: {
            title: result.metadata?.title || null,
            description: result.metadata?.description || null,
            language: result.metadata?.language || null,
            sourceURL: result.url,
            statusCode: result.success ? 200 : 500,
            error: result.error || null
          }
        })) : null
      };
    } catch (error) {
      console.error('Get crawl status error:', error);
      throw error;
    }
  }

  _mapStatus = (internalStatus) => {
    const statusMap = {
      'pending': 'queued',
      'processing': 'scraping',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled'
    };
    return statusMap[internalStatus] || internalStatus;
  }
}

module.exports = new FirecrawlAdapter();