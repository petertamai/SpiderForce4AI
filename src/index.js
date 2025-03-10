// src/index.js
const express = require('express');
const browserManager = require('./utils/browser-manager');
const firecrawlRoutes = require('./routes/firecrawl');
const { cleanContent } = require('./utils/cleaner.js_old');
const { convertToMarkdown } = require('./utils/converter.js_old');
const { extractMetadata, formatMetadata } = require('./utils/metadata');
const webhookHandler = require('./utils/webhook-handler');
const crawlerHandler = require('./utils/crawl_urls_sitemap.js');
const marked = require('marked');
const concurrentCrawler = require('./utils/concurrent-crawler');
const app = express();
app.use(express.json());
app.use('/v1', firecrawlRoutes);
// Configure timeout and other constants
const PAGE_TIMEOUT = 30000; // 30 seconds 
const MAX_RETRIES = 2;

/**
 * Main conversion function
 */

/**
 * Initialize services in the correct order
 */
async function initializeServices() {
  try {
    console.log('Initializing services...');
    
    // Initialize the browser manager first
    console.log('Initializing browser manager...');
    await browserManager.getBrowser();
    
    // Initialize Redis and caching
    console.log('Initializing Redis and caching...');
    if (typeof concurrentCrawler.initializeRedis === 'function') {
      await concurrentCrawler.initializeRedis();
      console.log('Redis initialization completed');
    } else {
      console.warn('Redis initialization function not found, continuing without Redis');
    }
    
    console.log('All services initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing services:', error);
    return false;
  }
}
/**
 * Main conversion function
 */
/**
 * Enhanced convertUrlToMarkdown function with caching and multi-stage fallback strategy
 */
async function convertUrlToMarkdown(url, options = {}, retryCount = 0, fallbackStage = 0) {
  let page = null;


  if (process.env.DISABLE_ALL_CACHING === 'true') {
    options.nocache = true; // Force cache bypass if all caching is disabled
  }
  // Check cache first if not bypassing cache
  const bypassCache = options.nocache === true;
  if (!bypassCache) {
    const cacheKey = `sf4ai:${url}-${JSON.stringify(options.targetSelectors || [])}-${JSON.stringify(options.removeSelectors || [])}`;
    
    try {
      // Check Redis cache first if enabled
      if (concurrentCrawler.isRedisEnabled()) {
        const redisClient = concurrentCrawler.getRedisClient();
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
          const cachedResult = JSON.parse(cachedData);
          console.log('\x1b[36m%s\x1b[0m', `[CACHE HIT ⚡] Redis cache used in convertUrlToMarkdown: ${url}`);
          return cachedResult.content;
        }
      } 
      // Fallback to LRU cache
      else if (concurrentCrawler.getLRUCache().has(cacheKey)) {
        const cachedResult = concurrentCrawler.getLRUCache().get(cacheKey);
        console.log('\x1b[36m%s\x1b[0m', `[CACHE HIT ⚡] LRU cache used in convertUrlToMarkdown: ${url}`);
        return cachedResult.content;
      }
    } catch (cacheError) {
      console.error(`[Cache] Error checking cache for ${url}:`, cacheError);
      // Continue with processing if cache check fails
    }
  } else {
    console.log('\x1b[33m%s\x1b[0m', `[CACHE BYPASS 🔄] nocache=true: ${url}`);
  }

  try {
    // Import required modules
    const dynamicContentHandler = require('./utils/dynamic-content-handler');
    const config = require('./utils/config');
    
    // Parse options with proper defaults
    const conversionOptions = {
      aggressive_cleaning: options.aggressive_cleaning !== undefined ? options.aggressive_cleaning : 
                          (options.aggressiveCleaning !== undefined ? options.aggressiveCleaning : 
                          (process.env.AGGRESSIVE_CLEANING !== undefined ? process.env.AGGRESSIVE_CLEANING === 'true' : true)),
      remove_images: options.remove_images !== undefined ? options.remove_images : 
                    (options.removeImages !== undefined ? options.removeImages : 
                    (process.env.REMOVE_IMAGES !== undefined ? process.env.REMOVE_IMAGES === 'true' : false)),
      targetSelectors: options.targetSelectors || [],
      removeSelectors: options.removeSelectors || [],
      min_content_length: options.min_content_length || options.minContentLength || 
                         parseInt(process.env.MIN_CONTENT_LENGTH, 10) || 500,
      dynamic_content_timeout: options.dynamic_content_timeout || options.dynamicContentTimeout || 
                              parseInt(process.env.DYNAMIC_CONTENT_TIMEOUT, 10) || 5000,
      scroll_wait_time: options.scroll_wait_time || options.scrollWaitTime || 
                       parseInt(process.env.SCROLL_WAIT_TIME, 10) || 200,
      nocache: options.nocache === true
    };

    // Log conversion options and fallback stage if applicable
    if (fallbackStage > 0) {
      console.log(`[${url}] 🛡️ FALLBACK STAGE ${fallbackStage}: ${fallbackStage === 1 ? 'Scroll and retry with aggressive cleaning' : 'Disable aggressive cleaning'}`);
      
      // Only disable aggressive cleaning in stage 2
      if (fallbackStage === 2) {
        conversionOptions.aggressive_cleaning = false;
      }
    }

    console.log(`[${url}] Using conversion options:`, conversionOptions);
    
    // Create page and navigate
    page = await browserManager.createPage();
    await browserManager.navigateToUrl(page, url);

    // Wait for content to be available
    await page.waitForFunction(() => 
      document.body && document.body.innerHTML.length > 0, 
      { timeout: PAGE_TIMEOUT }
    );

    // Evaluate content richness before any processing
    const initialContentStats = await dynamicContentHandler.evaluateContentRichness(page);
    console.log(`[${url}] Initial content stats: ${initialContentStats.textLength} chars, ${initialContentStats.elementCount} elements`);
    
    // Only scroll in initial attempt if content is below threshold
    // In fallback stage 1, always scroll regardless of content length
    if (initialContentStats.textLength < conversionOptions.min_content_length || fallbackStage === 1) {
      console.log(`[${url}] ${fallbackStage === 1 ? 'Forced scroll in fallback mode' : 'Content length below threshold'}, scrolling to load dynamic content...`);
      
      try {
        // Scroll to the bottom of the page
        await page.evaluate(() => {
          try {
            if (document.body) {
              window.scrollTo(0, document.body.scrollHeight);
              return true;
            }
            return false;
          } catch (e) {
            console.error('Error scrolling:', e);
            return false;
          }
        });
        
        // Wait 200ms after scrolling
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
        console.log(`[${url}] Scrolled to bottom and waited 200ms`);
      } catch (scrollError) {
        console.error(`[${url}] Error during scrolling: ${scrollError.message}`);
        // Continue anyway - we'll try to extract whatever content is available
      }
    } else if (fallbackStage === 0) {
      console.log(`[${url}] Initial content length (${initialContentStats.textLength}) exceeds minimum threshold (${conversionOptions.min_content_length}), skipping dynamic content loading`);
    }

    // Re-evaluate content after dynamic loading attempts
    const updatedContentStats = await dynamicContentHandler.evaluateContentRichness(page);
    console.log(`[${url}] Updated content stats: ${updatedContentStats.textLength} chars, ${updatedContentStats.elementCount} elements`);
    
    // Extract metadata
    console.log(`[${url}] Extracting metadata...`);
    const metadata = await extractMetadata(page);
    const formattedMetadata = formatMetadata(metadata);

    // Clean and convert content
    console.log(`[${url}] Cleaning content...`);
    const cleanedHtml = await cleanContent(page, conversionOptions);

    console.log(`[${url}] Converting to markdown...`);
    const contentMarkdown = await convertToMarkdown(cleanedHtml, conversionOptions);
    
    // Verify content length meets minimum threshold
    if (contentMarkdown.length < conversionOptions.min_content_length) {
      // IMPLEMENT FALLBACK STRATEGY
      if (fallbackStage === 0) {
        // Try STAGE 1: Scroll to bottom, wait 200ms, and retry with aggressive cleaning
        console.log(`[${url}] Content length (${contentMarkdown.length}) below minimum threshold (${conversionOptions.min_content_length})`);
        console.log(`[${url}] Trying fallback strategy - Stage 1: Scroll to bottom, wait 200ms, retry with aggressive cleaning`);
        
        // Close current page before retry to prevent memory issues
        if (page) {
          await browserManager.closePage(page).catch(err => console.error('Error closing page:', err));
          page = null;
        }
        
        return convertUrlToMarkdown(url, options, retryCount, 1);
      } 
      else if (fallbackStage === 1) {
        // Try STAGE 2: Disable aggressive cleaning, scroll to bottom, wait 200ms
        console.log(`[${url}] Stage 1 fallback still insufficient (${contentMarkdown.length} chars)`);
        console.log(`[${url}] Trying fallback strategy - Stage 2: Disable aggressive cleaning, scroll to bottom, wait 200ms`);
        
        // Close current page before retry to prevent memory issues
        if (page) {
          await browserManager.closePage(page).catch(err => console.error('Error closing page:', err));
          page = null;
        }
        
        return convertUrlToMarkdown(url, options, retryCount, 2);
      }
      else {
        // We've tried all fallback strategies, just return what we have
        console.log(`[${url}] ⚠️ All fallback strategies attempted. Returning best effort content (${contentMarkdown.length} chars)`);
      }
    }

    // Log final content stats
    console.log(`[${url}] Final markdown length: ${contentMarkdown.length} characters`);
    
    // Combine all parts
    const result = `URL: ${url}\n\n${formattedMetadata}\n\n---\n\n${contentMarkdown}`;
    
    // Cache the result if not bypassing cache
    if (!bypassCache) {
      const cacheKey = `sf4ai:${url}-${JSON.stringify(options.targetSelectors || [])}-${JSON.stringify(options.removeSelectors || [])}`;
      
      try {
        const cacheData = {
          url,
          success: true,
          content: result,
          timestamp: new Date().toISOString()
        };
        
        // Store in Redis if enabled
        if (concurrentCrawler.isRedisEnabled()) {
          const redisClient = concurrentCrawler.getRedisClient();
          const REDIS_CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL || '3600', 10);
          await redisClient.set(cacheKey, JSON.stringify(cacheData), 'EX', REDIS_CACHE_TTL);
          console.log(`[${url}] Result cached in Redis successfully`);
        } 
        // Otherwise use LRU cache
        else {
          concurrentCrawler.getLRUCache().set(cacheKey, cacheData);
          console.log(`[${url}] Result cached in LRU cache successfully`);
        }
      } catch (cacheError) {
        console.error(`[${url}] Error caching result:`, cacheError);
      }
    }
    
    return result;

  } catch (error) {
    console.error(`[${url}] Error during conversion:`, error);

    // Retry logic for specific errors
    if (retryCount < MAX_RETRIES && (
      error.message.includes('net::') ||
      error.message.includes('Navigation timeout') ||
      error.message.includes('Protocol error')
    )) {
      console.log(`[${url}] Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
      return convertUrlToMarkdown(url, options, retryCount + 1, fallbackStage);
    }

    // If caching is enabled, check one last time for a cached version
    if (!bypassCache) {
      try {
        const cacheKey = `sf4ai:${url}-${JSON.stringify(options.targetSelectors || [])}-${JSON.stringify(options.removeSelectors || [])}`;
        
        // Check Redis first
        if (concurrentCrawler.isRedisEnabled()) {
          const redisClient = concurrentCrawler.getRedisClient();
          const cachedData = await redisClient.get(cacheKey);
          
          if (cachedData) {
            const cachedResult = JSON.parse(cachedData);
            console.log(`[${url}] ⚠️ Error encountered but found Redis cached version, using that as fallback`);
            return cachedResult.content;
          }
        } 
        // Then check LRU cache
        else if (concurrentCrawler.getLRUCache().has(cacheKey)) {
          const cachedResult = concurrentCrawler.getLRUCache().get(cacheKey);
          console.log(`[${url}] ⚠️ Error encountered but found LRU cached version, using that as fallback`);
          return cachedResult.content;
        }
      } catch (e) {
        // Ignore errors in emergency cache lookup
        console.error(`[${url}] Error during emergency cache lookup:`, e);
      }
    }

    throw error;
  } finally {
    if (page) {
      await browserManager.closePage(page)
        .catch(err => console.error('Error closing page:', err));
    }
  }
}

/**
 * Parse selectors from query string or body
 */
function parseSelectors(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return input.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * URL validation helper
 */
function validateAndFormatUrl(inputUrl) {
  try {
    // Add protocol if missing
    const url = !inputUrl.startsWith('http') ? `https://${inputUrl}` : inputUrl;
    new URL(url); // Will throw if invalid
    return url;
  } catch (error) {
    throw new Error('Invalid URL provided');
  }
}

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    const browser = await browserManager.getBrowser();
    const pages = await browser.pages();
    res.json({
      status: 'healthy',
      browser: 'connected',
      activePages: pages.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET endpoint for basic conversion with optional selectors
 */
// Fix for the processUrl return value handling in GET and POST /convert endpoints

// GET endpoint for basic conversion with optional selectors
app.get('/convert', async (req, res) => {


  try {
    const { 
      url, 
      targetSelectors, 
      removeSelectors,
      aggressive_cleaning,
      remove_images,
      aggressiveCleaning,
      removeImages,
      nocache
    } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL parameter is required',
        usage: {
          basic: '/convert?url=https://example.com',
          withSelectors: '/convert?url=https://example.com&targetSelectors=.main-content,.article',
          withConfig: '/convert?url=https://example.com&aggressive_cleaning=false&remove_images=true&nocache=true'
        }
      });
    }

    const options = {
      targetSelectors: parseSelectors(targetSelectors),
      removeSelectors: parseSelectors(removeSelectors),
      aggressive_cleaning: aggressive_cleaning !== undefined ? aggressive_cleaning === 'true' : undefined,
      remove_images: remove_images !== undefined ? remove_images === 'true' : undefined,
      aggressiveCleaning: aggressiveCleaning !== undefined ? aggressiveCleaning === 'true' : undefined,
      removeImages: removeImages !== undefined ? removeImages === 'true' : undefined,
      nocache: nocache === 'true' // Convert string to boolean
    };


    if (process.env.DISABLE_ALL_CACHING === 'true') {
      console.log(`[CACHE DISABLED] All caching disabled by environment config`);
      options.nocache = true; // Force nocache when DISABLE_ALL_CACHING is true
    }
  

    const formattedUrl = validateAndFormatUrl(url);
    
    // Check cache before processing using the concurrent-crawler's methods
    const bypassCache = options.nocache === true;
    if (!bypassCache) {
      // Create cache key the same way concurrent-crawler does
      const cacheKey = `sf4ai:${formattedUrl}-${JSON.stringify(options.targetSelectors || [])}-${JSON.stringify(options.removeSelectors || [])}`;
      
      // Try to get from cache
      let cachedResult = null;
      
      // Check if Redis is enabled
      if (concurrentCrawler.isRedisEnabled()) {
        try {
          const cachedData = await concurrentCrawler.getRedisClient().get(cacheKey);
          if (cachedData) {
            cachedResult = JSON.parse(cachedData);
            console.log('\x1b[36m%s\x1b[0m', `[CACHE HIT ⚡] Redis cache: ${formattedUrl}`);
          }
        } catch (cacheError) {
          console.error(`Redis cache error for ${formattedUrl}:`, cacheError);
        }
      } else if (concurrentCrawler.getLRUCache().has(cacheKey)) {
        // Try LRU cache if Redis is not available
        cachedResult = concurrentCrawler.getLRUCache().get(cacheKey);
        console.log('\x1b[36m%s\x1b[0m', `[CACHE HIT ⚡] LRU cache: ${formattedUrl}`);
      }
      
      // Return cached result if found
      if (cachedResult && cachedResult.content) {
        res.setHeader('Content-Type', 'text/markdown');
        res.send(cachedResult.content);
        return;
      }
    } else {
      console.log('\x1b[33m%s\x1b[0m', `[CACHE BYPASS 🔄] nocache=true: ${formattedUrl}`);
    }
    
    // Create a temporary job for this request
    const tempJob = {
      id: `temp_${Date.now()}`,
      config: options,
      processedUrls: new Set()
    };
    
    // Process the URL 
    const result = await convertUrlToMarkdown(formattedUrl, options);
    
    // Cache the result for future requests
    if (!bypassCache) {
      const cacheData = {
        url: formattedUrl,
        success: true,
        content: result,
        timestamp: new Date().toISOString()
      };
      
      const cacheKey = `sf4ai:${formattedUrl}-${JSON.stringify(options.targetSelectors || [])}-${JSON.stringify(options.removeSelectors || [])}`;
      
      // Store in cache
      try {
        if (concurrentCrawler.isRedisEnabled()) {
          const REDIS_CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL || '3600', 10);
          await concurrentCrawler.getRedisClient().set(cacheKey, JSON.stringify(cacheData), 'EX', REDIS_CACHE_TTL);
          console.log(`[Cache] Stored in Redis: ${formattedUrl}`);
        } else {
          concurrentCrawler.getLRUCache().set(cacheKey, cacheData);
          console.log(`[Cache] Stored in LRU cache: ${formattedUrl}`);
        }
      } catch (cacheError) {
        console.error(`[Cache] Error storing result for ${formattedUrl}:`, cacheError);
      }
    }
    
    // Format response
    res.setHeader('Content-Type', 'text/markdown');
    res.send(result);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(error.message.includes('Invalid URL') ? 400 : 500)
      .json({ 
        error: 'Conversion failed', 
        details: error.message 
      });
  }
});



app.post('/', (req, res) => {
    res.json({ "result": "pong" });
  });

/**
 * POST endpoint for advanced options
 */
app.post('/convert', async (req, res) => {


  try {
    const { 
      url, 
      targetSelectors, 
      removeSelectors, 
      aggressive_cleaning,
      remove_images,
      aggressiveCleaning,
      removeImages,
      nocache,
      custom_webhook 
    } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL is required in request body',
        example: {
          url: 'https://example.com',
          targetSelectors: ['.main-content', 'article'],
          removeSelectors: ['.ads', '.nav'],
          aggressive_cleaning: false,
          remove_images: true,
          nocache: true,
          custom_webhook: {
            url: 'https://your-webhook.com/endpoint',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer token'
            }
          }
        }
      });
    }

    const options = {
      targetSelectors: parseSelectors(targetSelectors),
      removeSelectors: parseSelectors(removeSelectors),
      aggressive_cleaning,
      remove_images,
      aggressiveCleaning,
      removeImages,
      nocache: nocache === true // Ensure it's boolean
    };

    if (process.env.DISABLE_ALL_CACHING === 'true') {
      console.log(`[CACHE DISABLED] All caching disabled by environment config`);
      options.nocache = true; // Force nocache when DISABLE_ALL_CACHING is true
    }

    const formattedUrl = validateAndFormatUrl(url);
    
    // Check cache before processing
    const bypassCache = options.nocache === true;
    if (!bypassCache) {
      const cacheKey = concurrentCrawler.createCacheKey(
        formattedUrl,
        options.targetSelectors,
        options.removeSelectors
      );
      
      const cachedResult = await concurrentCrawler.getCacheByKey(cacheKey);
      if (cachedResult && cachedResult.content) {
        console.log('\x1b[36m%s\x1b[0m', `[CACHE HIT ⚡] Cache used for: ${formattedUrl}`);
        
        // Handle webhook if configured with cached result
        if (custom_webhook) {
          await webhookHandler.sendWebhook(custom_webhook, {
            url: formattedUrl,
            markdown: cachedResult.content,
            metadata: req.body,
            options,
            fromCache: true
          });
        }
        
        // Send response
        if (req.headers.accept?.includes('application/json')) {
          res.json({
            markdown: cachedResult.content,
            webhook_result: custom_webhook ? { success: true, fromCache: true } : null,
            fromCache: true,
            config: {
              aggressive_cleaning: options.aggressive_cleaning,
              remove_images: options.remove_images,
              nocache: options.nocache
            }
          });
        } else {
          res.setHeader('Content-Type', 'text/markdown');
          res.send(cachedResult.content);
        }
        return;
      }
    } else {
      console.log('\x1b[33m%s\x1b[0m', `[CACHE BYPASS 🔄] nocache=true: ${formattedUrl}`);
    }
    
    // Use direct conversion
    const result = await convertUrlToMarkdown(formattedUrl, options);

    // Cache result if caching is enabled
    if (!bypassCache) {
      const cacheData = {
        url: formattedUrl,
        success: true,
        content: result,
        timestamp: new Date().toISOString()
      };
      
      const cacheKey = concurrentCrawler.createCacheKey(
        formattedUrl,
        options.targetSelectors,
        options.removeSelectors
      );
      
      await concurrentCrawler.setCacheByKey(cacheKey, cacheData);
    }

    // Handle webhook if configured
    let webhookResult = null;
    if (custom_webhook) {
      webhookResult = await webhookHandler.sendWebhook(custom_webhook, {
        url: formattedUrl,
        markdown: result,
        metadata: req.body,
        options
      });
    }

    // Send response
    if (req.headers.accept?.includes('application/json')) {
      res.json({
        markdown: result,
        webhook_result: webhookResult,
        config: {
          aggressive_cleaning: options.aggressive_cleaning,
          remove_images: options.remove_images,
          nocache: options.nocache
        }
      });
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(result);
    }

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(error.message.includes('Invalid URL') ? 400 : 500)
      .json({ 
        error: 'Conversion failed', 
        details: error.message 
      });
  }
});
// Crawl sitemap endpoint
app.post('/crawl_sitemap', async (req, res) => {
  try {
    const { 
      sitemapUrl, 
      targetSelectors, 
      removeSelectors,
      webhook,
      maxConcurrent,
      batchSize,
      processingDelay,
      retryCount,
      retryDelay,
      aggressive_cleaning,
      remove_images,
      nocache // Add nocache parameter
    } = req.body;

    if (!sitemapUrl) {
      return res.status(400).json({
        error: 'sitemapUrl is required',
        example: {
          sitemapUrl: "https://example.com/sitemap.xml",
          targetSelectors: [".main-content", "article"],
          removeSelectors: [".ads", ".nav"],
          maxConcurrent: 5,
          batchSize: 10,
          nocache: true, // Add to example
          webhook: {/* ... */}
        }
      });
    }

    // Use the concurrent crawler
    const jobResult = await concurrentCrawler.createJob({
      sitemapUrl,
      targetSelectors,
      removeSelectors,
      webhook,
      maxConcurrent,
      batchSize,
      processingDelay,
      retryCount,
      retryDelay,
      aggressive_cleaning,
      remove_images,
      nocache // Pass through to job
    });

    res.json({
      ...jobResult,
      message: `Sitemap crawl job started with ID: ${jobResult.jobId}`,
      endpoints: {
        status: `/job/${jobResult.jobId}`,
        cancel: `/job/${jobResult.jobId}/cancel`
      }
    });
  } catch (error) {
    console.error('Sitemap crawl error:', error);
    res.status(500).json({
      error: 'Crawl failed',
      details: error.message
    });
  }
});
  
  // Crawl multiple URLs endpoint
  app.post('/crawl_urls', async (req, res) => {
    try {
      const { 
        urls, 
        targetSelectors, 
        removeSelectors,
        webhook,
        maxConcurrent,
        batchSize,
        processingDelay,
        retryCount,
        retryDelay,
        aggressive_cleaning,
        remove_images,
        nocache // Add nocache parameter
      } = req.body;
  
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          error: 'urls array is required',
          example: {
            urls: [
              "https://example.com/page1",
              "https://example.com/page2"
            ],
            targetSelectors: [".main-content", "article"],
            removeSelectors: [".ads", ".nav"],
            maxConcurrent: 3,
            batchSize: 5,
            nocache: true, // Add to example
            webhook: {/* ... */}
          }
        });
      }
  
      // Use the concurrent crawler
      const jobResult = await concurrentCrawler.createJob({
        urls,
        targetSelectors,
        removeSelectors,
        webhook,
        maxConcurrent,
        batchSize,
        processingDelay,
        retryCount,
        retryDelay,
        aggressive_cleaning,
        remove_images,
        nocache // Pass through to job
      });
  
      res.json({
        ...jobResult,
        message: `URL batch crawl job started with ID: ${jobResult.jobId}`,
        endpoints: {
          status: `/job/${jobResult.jobId}`,
          cancel: `/job/${jobResult.jobId}/cancel`
        }
      });
    } catch (error) {
      console.error('URLs crawl error:', error);
      res.status(500).json({
        error: 'Crawl failed',
        details: error.message
      });
    }
  });
  
  // Job status endpoint
  app.get('/job/:jobId', (req, res) => {
    const status = concurrentCrawler.getJobStatus(req.params.jobId);
    
    if (status.status === 'not_found') {
      return res.status(404).json({
        error: 'Job not found',
        jobId: req.params.jobId
      });
    }
    
    res.json(status);
  });

  app.post('/job/:jobId/cancel', (req, res) => {
    const result = concurrentCrawler.cancelJob(req.params.jobId);
    
    if (!result.success) {
      return res.status(404).json({
        error: result.error,
        jobId: req.params.jobId
      });
    }
    
    res.json(result);
  });

  app.get('/job/:jobId/results', async (req, res) => {
    try {
      const results = await concurrentCrawler.getJobResults(req.params.jobId);
      
      if (!results) {
        return res.status(404).json({
          error: 'Job results not found',
          jobId: req.params.jobId
        });
      }
      
      // Check if client wants full results or just summary
      const includeFull = req.query.full === 'true';
      
      if (!includeFull && results.results?.length > 50) {
        // Return summary without full results for large jobs
        const { results: fullResults, ...summary } = results;
        return res.json({
          ...summary,
          resultsCount: fullResults.length,
          note: 'Results array omitted due to size. Use ?full=true to get full results.'
        });
      }
      
      res.json(results);
    } catch (error) {
      console.error(`Error fetching results for job ${req.params.jobId}:`, error);
      res.status(500).json({
        error: 'Failed to retrieve job results',
        details: error.message
      });
    }
  });
  
  // Add new endpoint for system metrics:
  app.get('/metrics', (req, res) => {
    const metrics = concurrentCrawler.getMetrics();
    res.json(metrics);
  });


// Homepage endpoint - Add this after your existing endpoints
// Homepage endpoint

const crypto = require('crypto');

app.get('/', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Path to your documentation HTML file
    const docsPath = path.join(__dirname, 'public', 'docs.html');
    
    // Read the HTML file
    const html = await fs.readFile(docsPath, 'utf-8');
    
    // Set headers and send the HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error serving documentation:', error);
    res.status(500).send('Error loading documentation. Please try again later.');
  }
});

app.get('/info', async (req, res) => {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Read README.md from project root
      const readmePath = path.join(__dirname, '..', 'home.md');
      const markdown = await fs.readFile(readmePath, 'utf-8');
  
      // Convert markdown to HTML using marked.parse()
      const htmlContent = marked.parse(markdown);
  
      // Basic HTML template with Tailwind
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SpiderForce4AI</title>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
            <style>
                pre {
                    background: #D0C9B9;
                    padding: 20px;
                    margin: 10px;
                }
                    h1{
                    font-size: 20px;
                    font-weight: 800;
                    padding-top:10px;
                    padding-bottom:10px;
                    }
                    h2{
                    font-size: 18px;
                    font-weight: 700;
                    padding-top:10px;
                    }
                    h3{
                    font-size: 16px;
                    font-weight: 700;
                    padding-top:10px;
                    }
                </style>
          </head>
          <body class="bg-gray-50">
            <div class="container mx-auto px-4 py-8">
              <div class="prose prose-lg max-w-none">
                ${htmlContent}
              </div>
            </div>
          </body>
        </html>
      `;
  
      res.send(html);
    } catch (error) {
      console.error('Error serving homepage:', error);
      res.status(500).send('Error loading homepage');
    }
  });
/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message
  });
});

/**
 * Server startup
 */
async function startServer() {
  try {

    await initializeServices();

    // Initialize browser at startup
    await browserManager.getBrowser();
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log('\n=== SpiderForce4AI (petertam.pro) ===');
      console.log(`Server running on port ${port}`);
      console.log('\nEndpoints:');
      console.log(`GET  http://localhost:${port}/convert?url=https://petertam.pro/`);
      console.log(`GET  http://localhost:${port}/convert?url=https://petertam.pro&targetSelectors=.main,.article`);
      console.log(`POST http://localhost:${port}/convert`);
      console.log(`POST  http://localhost:3000/crawl_sitemap`);
      console.log(`POST  http://localhost:3000/crawl_urls`);
      console.log(`GET  http://localhost:${port}/health`);
      console.log('\nPress Ctrl+C to stop the server\n');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => cleanup('SIGTERM'));
    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      cleanup('uncaughtException');
    });

  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

/**
 * Cleanup handler
 */
async function cleanup(signal) {
  console.log(`\nReceived ${signal}. Cleaning up...`);
  try {
    await browserManager.cleanup();
    console.log('Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Start the server
startServer();