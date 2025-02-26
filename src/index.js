// src/index.js
const express = require('express');
const browserManager = require('./utils/browser-manager');
const firecrawlRoutes = require('./routes/firecrawl');
const { cleanContent } = require('./utils/cleaner');
const { convertToMarkdown } = require('./utils/converter');
const { extractMetadata, formatMetadata } = require('./utils/metadata');
const webhookHandler = require('./utils/webhook-handler');
const crawlerHandler = require('./utils/crawl_urls_sitemap.js');
const marked = require('marked');

const app = express();
app.use(express.json());
app.use('/v1', firecrawlRoutes);
// Configure timeout and other constants
const PAGE_TIMEOUT = 30000; // 30 seconds 
const MAX_RETRIES = 2;

/**
 * Main conversion function
 */

// In index.js, modify the convertUrlToMarkdown function to pass options

// In index.js - modify the convertUrlToMarkdown function

/**
 * Main conversion function
 */
/**
 * Enhanced convertUrlToMarkdown function with multi-stage fallback strategy
 * Prioritizes SPEED while ensuring content is always extracted
 */
/**
 * Enhanced convertUrlToMarkdown function with multi-stage fallback strategy
 * Prioritizes SPEED while ensuring content is always extracted
 */
async function convertUrlToMarkdown(url, options = {}, retryCount = 0, fallbackStage = 0) {
  let page = null;

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
                       parseInt(process.env.SCROLL_WAIT_TIME, 10) || 200
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
    return `URL: ${url}\n\n${formattedMetadata}\n\n---\n\n${contentMarkdown}`;

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
app.get('/convert', async (req, res) => {
  try {
    const { 
      url, 
      targetSelectors, 
      removeSelectors,
      aggressive_cleaning,
      remove_images,
      aggressiveCleaning, // support camelCase too
      removeImages
    } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'URL parameter is required',
        usage: {
          basic: '/convert?url=https://example.com',
          withSelectors: '/convert?url=https://example.com&targetSelectors=.main-content,.article',
          withConfig: '/convert?url=https://example.com&aggressive_cleaning=false&remove_images=true'
        }
      });
    }

    const options = {
      targetSelectors: parseSelectors(targetSelectors),
      removeSelectors: parseSelectors(removeSelectors),
      aggressive_cleaning,
      remove_images,
      aggressiveCleaning,
      removeImages
    };

    const formattedUrl = validateAndFormatUrl(url);
    const markdown = await convertUrlToMarkdown(formattedUrl, options);

    res.setHeader('Content-Type', 'text/markdown');
    res.send(markdown);

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
      removeImages
    };

    const formattedUrl = validateAndFormatUrl(url);
    const markdown = await convertUrlToMarkdown(formattedUrl, options);

    // Handle webhook if configured
    let webhookResult = null;
    if (custom_webhook) {
      webhookResult = await webhookHandler.sendWebhook(custom_webhook, {
        url: formattedUrl,
        markdown,
        metadata: req.body,
        options
      });
    }

    // Send response
    if (req.headers.accept?.includes('application/json')) {
      res.json({
        markdown,
        webhook_result: webhookResult,
        config: {
          aggressive_cleaning: options.aggressive_cleaning,
          remove_images: options.remove_images
        }
      });
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(markdown);
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
        webhook
      } = req.body;
  
      if (!sitemapUrl) {
        return res.status(400).json({
          error: 'sitemapUrl is required',
          example: {
            sitemapUrl: "https://example.com/sitemap.xml",
            targetSelectors: [".main-content", "article"],
            removeSelectors: [".ads", ".nav"],
            webhook: {
              url: "https://your-webhook.com/endpoint",
              headers: {
                "Authorization": "Bearer token"
              },
              progressUpdates: true,
              extraFields: {
                project: "my-crawler",
                source: "sitemap"
              }
            }
          }
        });
      }
  
      const jobResult = await crawlerHandler.createJob({
        sitemapUrl,
        targetSelectors,
        removeSelectors,
        webhook
      });
  
      res.json(jobResult);
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
        webhook
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
            webhook: {
              url: "https://your-webhook.com/endpoint",
              headers: {
                "Authorization": "Bearer token"
              },
              progressUpdates: true,
              extraFields: {
                project: "my-crawler",
                source: "url-list"
              }
            }
          }
        });
      }
  
      const jobResult = await crawlerHandler.createJob({
        urls,
        targetSelectors,
        removeSelectors,
        webhook
      });
  
      res.json(jobResult);
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
    const status = crawlerHandler.getJobStatus(req.params.jobId);
    res.json(status);
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