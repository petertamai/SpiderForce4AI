// src/utils/concurrent-crawler.js
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const browserManager = require('./browser-manager');
const { cleanContent } = require('./cleaner');
const { convertToMarkdown } = require('./converter');
const { extractMetadata, formatMetadata } = require('./metadata');
const fs = require('fs').promises;
const path = require('path');
const { LRUCache } = require('lru-cache');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Redis client setup (conditionally loaded)
let Redis = null;
let redisClient = null;
let useRedis = false;

const REDIS_CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL || '3600', 10); // Default: 1 hour
const LRU_CACHE_TTL = parseInt(process.env.LRU_CACHE_TTL || '3600000', 10); // Default: 1 hour


// Initialize Redis based on configuration
function initRedis() {
  try {
    const redisMode = process.env.USE_REDIS || 'none';
    
    if (redisMode === 'none') {
      console.log('Redis disabled by configuration');
      useRedis = false;
      return;
    }
    
    // Dynamically import ioredis only if needed
    try {
      Redis = require('ioredis');
      useRedis = true;
    } catch (error) {
      console.error('Failed to load ioredis module:', error.message);
      console.log('Make sure to install ioredis with: npm install --save ioredis');
      console.log('Falling back to LRU cache');
      useRedis = false;
      return;
    }
    
    if (redisMode === 'internal') {
      console.log('Using internal Redis connection');
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '0', 10),
        maxRetriesPerRequest: 3
      });
    } else if (redisMode === 'external') {
      const externalUrl = process.env.EXTERNAL_REDIS_URL;
      if (!externalUrl) {
        console.error('External Redis URL not provided, falling back to LRU cache');
        useRedis = false;
        return;
      }
      
      console.log(`Using external Redis connection: ${externalUrl.replace(/\/\/.*:(.*)@/, '//***:***@')}`);
      redisClient = new Redis(externalUrl);
    }
    
    // Test Redis connection
    redisClient.on('connect', () => {
        console.log('✅ Redis connected successfully and will be used for caching');
        // Try a simple set/get test
        redisClient.set('redis_test', 'working', 'EX', 10)
          .then(() => redisClient.get('redis_test'))
          .then((result) => {
            if (result === 'working') {
              console.log('✅ Redis cache test successful');
              useRedis = true;
            } else {
              console.error('⚠️ Redis cache test failed - falling back to LRU cache');
              useRedis = false;
            }
          })
          .catch(err => {
            console.error('⚠️ Redis operations test failed:', err);
            console.log('⚠️ Falling back to LRU cache');
            useRedis = false;
          });
      });
    
    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
      console.log('Falling back to LRU cache');
      useRedis = false;
    });
  } catch (error) {
    console.error('Redis initialization error:', error);
    console.log('Falling back to LRU cache');
    useRedis = false;
  }
}

// Initialize Redis on module load
initRedis();

class ConcurrentCrawler {
  constructor() {
    this.jobs = new Map();
    this.parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true
    });
    this.reportsDir = path.join(process.cwd(), 'crawl_reports');
    this.ensureReportDirectory();
    
    // Create LRU cache for results when Redis is not available
    this.resultsCache = new LRUCache({
        max: 1000,
        ttl: LRU_CACHE_TTL, // Use the environment variable
        updateAgeOnGet: false
      });
    
    // Performance metrics
    this.metrics = {
      totalProcessed: 0,
      successCount: 0,
      failCount: 0,
      totalTime: 0,
      avgProcessingTime: 0
    };
  }

  async ensureReportDirectory() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating reports directory:', error);
    }
  }

  /**
   * Create and start a new crawl job
   * @param {Object} config Job configuration
   * @returns {Object} Job information
   */
  async createJob(config) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = {
      id: jobId,
      status: 'pending',
      config: {
        ...config,
        nocache: config.nocache !== undefined ? config.nocache : !(process.env.DEFAULT_USE_CACHE === 'true'),
        maxConcurrent: config.maxConcurrent || parseInt(process.env.DEFAULT_MAX_CONCURRENT || '5', 10),
        batchSize: config.batchSize || parseInt(process.env.DEFAULT_BATCH_SIZE || '10', 10),
        processingDelay: config.processingDelay || parseInt(process.env.DEFAULT_PROCESSING_DELAY || '100', 10),
        targetSelectors: config.targetSelectors || [],
        removeSelectors: config.removeSelectors || [],
        retryCount: config.retryCount || parseInt(process.env.DEFAULT_RETRY_COUNT || '2', 10),
        retryDelay: config.retryDelay || parseInt(process.env.DEFAULT_RETRY_DELAY || '3000', 10),
        aggressive_cleaning: config.aggressive_cleaning !== undefined ? config.aggressive_cleaning : 
                            (process.env.AGGRESSIVE_CLEANING !== undefined ? process.env.AGGRESSIVE_CLEANING === 'true' : true),
        remove_images: config.remove_images !== undefined ? config.remove_images : 
                      (process.env.REMOVE_IMAGES !== undefined ? process.env.REMOVE_IMAGES === 'true' : false)
      },
      results: [],
      startTime: Date.now(),
      processed: 0,
      success: 0,
      failed: 0,
      total: 0,
      processedUrls: new Set(),
      failedUrls: new Set(),
      reportFile: path.join(this.reportsDir, `${jobId}.json`),
      batches: [],
      currentBatch: 0,
      errors: []
    };

    this.jobs.set(jobId, job);
    
    // Start job processing asynchronously
    this.processJob(jobId).catch(error => {
      console.error(`Error processing job ${jobId}:`, error);
      job.status = 'failed';
      job.error = error.message;
      this.saveJobState(job).catch(console.error);
    });

    // Return initial job information
    return {
      jobId,
      status: 'started',
      config: {
        sitemapUrl: config.sitemapUrl,
        urls: config.urls ? `${config.urls.length} URLs` : undefined,
        maxConcurrent: job.config.maxConcurrent,
        batchSize: job.config.batchSize,
        targetSelectors: job.config.targetSelectors,
        removeSelectors: job.config.removeSelectors,
        webhook: config.webhook ? {
          url: config.webhook.url,
          progressUpdates: config.webhook.progressUpdates
        } : null
      }
    };
  }

  /**
   * Fetch URLs from a sitemap
   * @param {string} sitemapUrl Sitemap URL
   * @returns {Array} List of URLs
   */
  async fetchSitemapUrls(sitemapUrl) {
    console.log(`Fetching sitemap: ${sitemapUrl}`);
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
      
      // Handle standard sitemap
      if (parsed.urlset?.url) {
        urls = Array.isArray(parsed.urlset.url) 
          ? parsed.urlset.url.map(u => typeof u === 'object' ? u.loc : u)
          : [parsed.urlset.url.loc || parsed.urlset.url];
      }
      // Handle sitemap index
      else if (parsed.sitemapindex?.sitemap) {
        const sitemaps = Array.isArray(parsed.sitemapindex.sitemap) 
          ? parsed.sitemapindex.sitemap.map(s => s.loc)
          : [parsed.sitemapindex.sitemap.loc];
          
        // Process sub-sitemaps in parallel with concurrency limit
        const allUrls = await this.processInBatches(
          sitemaps,
          async (submapUrl) => {
            try {
              return await this.fetchSitemapUrls(submapUrl);
            } catch (error) {
              console.error(`Error fetching sub-sitemap ${submapUrl}:`, error);
              return [];
            }
          },
          5 // Maximum concurrent sub-sitemap fetches
        );
        
        // Flatten results
        urls = allUrls.flat();
      }

      console.log(`Found ${urls.length} URLs in sitemap`);

      // Filter valid URLs
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

  /**
   * Process a job
   * @param {string} jobId Job ID
   */
  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      console.log(`[Job ${jobId}] Starting job processing`);
      
      // Fetch URLs from sitemap or use provided URLs
      let urls = [];
      if (job.config.sitemapUrl) {
        urls = await this.fetchSitemapUrls(job.config.sitemapUrl);
      } else if (job.config.urls) {
        urls = job.config.urls;
      }

      if (!urls?.length) {
        throw new Error('No valid URLs found');
      }

      job.total = urls.length;
      
      // Split URLs into batches
      const batchSize = job.config.batchSize;
      for (let i = 0; i < urls.length; i += batchSize) {
        job.batches.push(urls.slice(i, i + batchSize));
      }
      
      console.log(`[Job ${jobId}] Processing ${urls.length} URLs in ${job.batches.length} batches`);
      
      // Process batches sequentially
      for (let batchIndex = 0; batchIndex < job.batches.length; batchIndex++) {
        job.currentBatch = batchIndex + 1;
        
        // Skip if job was cancelled
        if (job.status === 'cancelled') {
          console.log(`[Job ${jobId}] Job cancelled, stopping further processing`);
          break;
        }
        
        const batch = job.batches[batchIndex];
        console.log(`[Job ${jobId}] Processing batch ${batchIndex + 1}/${job.batches.length} with ${batch.length} URLs`);
        
        // Process batch with concurrency limit
        const batchStartTime = Date.now();
        const results = await this.processInBatches(
          batch,
          async (url) => this.processUrl(url, job),
          job.config.maxConcurrent
        );
        
        // Update job state with results
        job.results.push(...results);
        job.processed += results.length;
        job.success += results.filter(r => r.success).length;
        job.failed += results.filter(r => !r.success).length;
        
        // Log batch completion
        const batchTime = (Date.now() - batchStartTime) / 1000;
        console.log(`[Job ${jobId}] Batch ${batchIndex + 1} completed in ${batchTime.toFixed(2)}s. Success: ${job.success}, Failed: ${job.failed}`);
        
        // Save current state
        await this.saveJobState(job);
        
        // Send progress webhook if configured
        if (job.config.webhook && job.config.webhook.progressUpdates) {
          await this.sendProgressWebhook(job, batchIndex).catch(error => {
            console.error(`[Job ${jobId}] Error sending progress webhook:`, error);
          });
        }
        
        // Apply processing delay between batches
        if (batchIndex < job.batches.length - 1 && job.config.processingDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, job.config.processingDelay));
        }
      }

      // Finalize job
      job.status = 'completed';
      job.endTime = Date.now();
      job.duration = (job.endTime - job.startTime) / 1000;
      console.log(`[Job ${jobId}] Job completed in ${job.duration.toFixed(2)}s. Processed: ${job.processed}, Success: ${job.success}, Failed: ${job.failed}`);
      
      await this.saveJobState(job);

      // Send final webhook if configured
      if (job.config.webhook) {
        await this.sendWebhook(job).catch(error => {
          console.error(`[Job ${jobId}] Error sending final webhook:`, error);
        });
      }
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      await this.saveJobState(job);
      console.error(`[Job ${jobId}] Job failed:`, error);
    }
  }

  /**
   * Process a single URL
   * @param {string} url URL to process
   * @param {Object} job Job object
   * @returns {Object} Processing result
   */
  async processUrl(url, job, retryCount = 0) {
    let page = null;
    const startTime = Date.now();
    
    // Create a cache key based on URL and selectors
    const cacheKey = `sf4ai:${url}-${JSON.stringify(job.config.targetSelectors)}-${JSON.stringify(job.config.removeSelectors)}`;
    const bypassCache = job.config.nocache === true; 
    // Check Redis cache first if enabled
    if (!bypassCache) {
        // Check Redis cache first if enabled
        if (useRedis && redisClient) {
          try {
            const cachedResult = await redisClient.get(cacheKey);
            if (cachedResult) {
              // Enhanced logging for Redis cache hit
              console.log('\x1b[36m%s\x1b[0m', `[CACHE HIT ⚡] Redis cache: ${url}`);
              return JSON.parse(cachedResult);
            }
          } catch (error) {
            console.error(`[Redis error] Failed to get cached result for ${url}:`, error.message);
          }
        } 
        // Fall back to LRU cache
        else if (this.resultsCache.has(cacheKey)) {
          // Enhanced logging for LRU cache hit
          console.log('\x1b[36m%s\x1b[0m', `[CACHE HIT ⚡] LRU cache: ${url}`);
          return this.resultsCache.get(cacheKey);
        }
      } else {
        console.log('\x1b[33m%s\x1b[0m', `[CACHE BYPASS 🔄] nocache=true: ${url}`);
      }
      
      // Log cache miss or bypass
      if (bypassCache) {
        console.log('\x1b[33m%s\x1b[0m', `[FORCED FETCH 🔍] Processing URL with cache bypass: ${url}`);
      } else {
        console.log('\x1b[33m%s\x1b[0m', `[CACHE MISS 🔍] Processing URL: ${url}`);
      }
    
    try {
      console.log(`Processing URL: ${url}`);
      job.processedUrls.add(url);
      
      page = await browserManager.createPage();
      await browserManager.navigateToUrl(page, url);

      // Extract metadata
      const metadata = await extractMetadata(page);
      const formattedMetadata = formatMetadata(metadata);
      
      // Clean content
      const cleanOptions = {
        targetSelectors: job.config.targetSelectors,
        removeSelectors: job.config.removeSelectors,
        aggressive_cleaning: job.config.aggressive_cleaning,
        remove_images: job.config.remove_images
      };
      
      const cleanedHtml = await cleanContent(page, cleanOptions);
      
      // Convert to markdown
      const markdown = await convertToMarkdown(cleanedHtml, cleanOptions);
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Successfully converted: ${url} (${duration.toFixed(2)}s)`);
      
      // Create result object
      const result = {
        url,
        success: true,
        metadata: formattedMetadata,
        content: markdown,
        timestamp: new Date().toISOString(),
        duration
      };
      
      // Cache the result
      if (useRedis && redisClient) {
        try {
          await redisClient.set(cacheKey, JSON.stringify(result), 'EX', REDIS_CACHE_TTL);
          console.log('\x1b[32m%s\x1b[0m', `[CACHE STORE 💾] Redis: ${url}`);
        } catch (error) {
          console.error(`[Redis error] Failed to cache result for ${url}:`, error.message);
          // Fall back to LRU cache
          this.resultsCache.set(cacheKey, result);
          console.log('\x1b[32m%s\x1b[0m', `[CACHE STORE 💾] LRU (fallback): ${url}`);
        }
      } else {
        this.resultsCache.set(cacheKey, result);
        console.log('\x1b[32m%s\x1b[0m', `[CACHE STORE 💾] LRU: ${url}`);
      }
      // Update metrics
      this.metrics.totalProcessed++;
      this.metrics.successCount++;
      this.metrics.totalTime += duration;
      this.metrics.avgProcessingTime = this.metrics.totalTime / this.metrics.totalProcessed;
      
      return result;
    } catch (error) {
      console.error(`❌ Error processing ${url}:`, error);
      
      // Retry logic
      if (retryCount < job.config.retryCount) {
        console.log(`Retrying ${url} (${retryCount + 1}/${job.config.retryCount})`);
        await new Promise(resolve => setTimeout(resolve, job.config.retryDelay));
        return this.processUrl(url, job, retryCount + 1);
      }
      
      // Failed after retries
      job.failedUrls.add(url);
      this.metrics.failCount++;
      
      return {
        url,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      if (page) {
        await browserManager.closePage(page).catch(err => {
          console.error(`Error closing page for ${url}:`, err);
        });
      }
    }
  }

  /**
   * Process items in batches with concurrency limit
   * @param {Array} items Items to process
   * @param {Function} processFn Processing function
   * @param {number} concurrencyLimit Maximum concurrent operations
   * @returns {Array} Processing results
   */
  async processInBatches(items, processFn, concurrencyLimit) {
    const results = [];
    const pendingPromises = new Set();
    
    for (const item of items) {
      // Create a promise for processing the item
      const promise = (async () => {
        try {
          return await processFn(item);
        } catch (error) {
          console.error(`Error processing item ${item}:`, error);
          return { error: error.message, item };
        } finally {
          pendingPromises.delete(promise);
        }
      })();
      
      // Add to tracking set
      pendingPromises.add(promise);
      
      // If we've reached the concurrency limit, wait for one to finish
      if (pendingPromises.size >= concurrencyLimit) {
        const resolved = await Promise.race([...pendingPromises]);
        results.push(resolved);
      }
    }
    
    // Wait for all remaining promises
    const remaining = await Promise.all([...pendingPromises]);
    results.push(...remaining);
    
    // Flatten arrays (for cases where processFn returns arrays, like sitemap processing)
    return results.flat().filter(Boolean);
  }

  /**
   * Save job state to file
   * @param {Object} job Job object
   */
  async saveJobState(job) {
    try {
      const state = {
        id: job.id,
        status: job.status,
        startTime: job.startTime,
        endTime: job.endTime,
        duration: job.duration,
        config: {
          sitemapUrl: job.config.sitemapUrl,
          targetSelectors: job.config.targetSelectors,
          removeSelectors: job.config.removeSelectors,
          maxConcurrent: job.config.maxConcurrent,
          batchSize: job.config.batchSize
        },
        summary: {
          total: job.total,
          processed: job.processed,
          successful: job.success,
          failed: job.failed,
          currentBatch: job.currentBatch,
          totalBatches: job.batches.length
        },
        results: job.results,
        error: job.error
      };

      await fs.writeFile(job.reportFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error(`Error saving job state for ${job.id}:`, error);
    }
  }

  /**
   * Send progress webhook
   * @param {Object} job Job object
   * @param {number} batchIndex Current batch index
   */
  async sendProgressWebhook(job, batchIndex) {
    if (!job.config.webhook?.url) return;
    
    try {
      const payload = {
        jobId: job.id,
        status: 'in_progress',
        progress: {
          processed: job.processed,
          total: job.total,
          percentage: Math.round((job.processed / job.total) * 100),
          success: job.success,
          failed: job.failed,
          batch: {
            current: batchIndex + 1,
            total: job.batches.length
          }
        },
        timestamp: new Date().toISOString()
      };
      
      // Add extra fields if provided
      if (job.config.webhook.extraFields) {
        Object.assign(payload, job.config.webhook.extraFields);
      }
      
      await axios.post(job.config.webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(job.config.webhook.headers || {})
        },
        timeout: 30000
      });
      
      console.log(`[Job ${job.id}] Progress webhook sent successfully`);
    } catch (error) {
      console.error(`[Job ${job.id}] Error sending progress webhook:`, error);
    }
  }

  /**
   * Send final webhook
   * @param {Object} job Job object
   */
  async sendWebhook(job) {
    try {
      if (!job.config.webhook?.url) {
        return;
      }

      console.log(`[Job ${job.id}] Sending final webhook`);
      
      // Check if it's a custom sendWebhook function
      if (job.config.webhook.sendWebhook) {
        console.log(`[Job ${job.id}] Using custom webhook handler`);
        await job.config.webhook.sendWebhook(job);
        return;
      }

      // Prepare payload
      const payload = {
        jobId: job.id,
        status: job.status,
        summary: {
          total: job.total,
          processed: job.processed,
          successful: job.success,
          failed: job.failed,
          processingTime: job.duration
        },
        results: {
          successful: job.results.filter(r => r.success).map(result => ({
            url: result.url,
            status: "success",
            markdown: result.content,
            error: null,
            timestamp: result.timestamp,
            metadata: result.metadata
          })),
          failed: job.results.filter(r => !r.success).map(result => ({
            url: result.url,
            status: "failed",
            markdown: null,
            error: result.error,
            timestamp: result.timestamp
          }))
        },
        timestamp: new Date().toISOString()
      };

      // Add extra fields if provided
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
      if (job.config.cleanupAfterWebhook) {
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
      }
    } catch (error) {
      console.error(`[Job ${job.id}] Webhook error:`, error.message);
      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId Job ID
   * @returns {Object} Job status
   */
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
        removeSelectors: job.config.removeSelectors,
        maxConcurrent: job.config.maxConcurrent,
        batchSize: job.config.batchSize
      },
      summary: {
        total: job.total,
        processed: job.processed,
        successful: job.success,
        failed: job.failed,
        currentBatch: job.currentBatch,
        totalBatches: job.batches.length,
        processingTime: job.endTime ? (job.endTime - job.startTime) / 1000 : null
      },
      results: job.processed <= 50 ? job.results : null, // Only include results for small jobs
      hasResults: job.results.length > 0,
      error: job.error,
      reportFile: job.reportFile
    };
  }

  /**
   * Cancel a job
   * @param {string} jobId Job ID
   * @returns {Object} Result
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    // Update job status
    job.status = 'cancelled';
    console.log(`[Job ${jobId}] Cancelled by user`);
    
    return { 
      success: true, 
      message: 'Job cancelled successfully',
      job: {
        id: jobId,
        status: job.status,
        processed: job.processed,
        total: job.total
      }
    };
  }

  /**
   * Get system metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeJobs: Array.from(this.jobs.values())
        .filter(job => job.status === 'processing')
        .length,
      totalJobs: this.jobs.size,
      cacheSize: this.resultsCache.size,
      cacheType: useRedis ? 'Redis' : 'LRU',
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get detailed job results
   * @param {string} jobId Job ID
   * @returns {Object} Job results
   */
  async getJobResults(jobId) {
    try {
      // Check memory first
      const job = this.jobs.get(jobId);
      if (job) {
        return {
          id: job.id,
          status: job.status,
          results: job.results,
          summary: {
            total: job.total,
            processed: job.processed,
            successful: job.success,
            failed: job.failed
          }
        };
      }
      
      // Fall back to file
      const reportFile = path.join(this.reportsDir, `${jobId}.json`);
      const data = await fs.readFile(reportFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading results for job ${jobId}:`, error);
      return null;
    }
  }
}

module.exports = new ConcurrentCrawler();