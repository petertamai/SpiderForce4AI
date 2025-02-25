// src/routes/firecrawl.js
const express = require('express');
const router = express.Router();
const firecrawlAdapter = require('../utils/firecrawl');

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization token'
    });
  }

  next();
};

// Single URL scraping endpoint
router.post('/scrape', authMiddleware, async (req, res) => {
  try {
    if (!req.body.url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const result = await firecrawlAdapter.handleScrape(req);
    res.json(result);
  } catch (error) {
    console.error('Scrape endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sitemap generation endpoint
router.post('/map', authMiddleware, async (req, res) => {
  try {
    if (!req.body.url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const result = await firecrawlAdapter.handleMap(req);
    res.json(result);
  } catch (error) {
    console.error('Map endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Batch scraping endpoint
router.post('/batch/scrape', authMiddleware, async (req, res) => {
  try {
    if (!req.body.urls || !Array.isArray(req.body.urls) || req.body.urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required'
      });
    }

    const result = await firecrawlAdapter.handleBatchScrape(req);
    res.json(result);
  } catch (error) {
    console.error('Batch scrape endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Crawl website endpoint
// Crawl website endpoint
router.post('/crawl', authMiddleware, async (req, res) => {
    try {
      const { url, limit, scrapeOptions = {}, webhook } = req.body;  // Add webhook here!

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      // Create a unique job ID
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('Starting crawl with config:', { url, limit, webhook });

      // Start the crawl job
      const result = await firecrawlAdapter.handleCrawl({
        url,
        limit: limit || 100,
        webhook,  // Pass webhook to adapter
        scrapeOptions: scrapeOptions || { formats: ['markdown'] },
        jobId
      });

      res.json(result);  // Return the full result including jobId and url
    } catch (error) {
      console.error('Crawl endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
// Get crawl status endpoint
router.get('/crawl/:jobId', authMiddleware, async (req, res) => {
  try {
    const status = await firecrawlAdapter.getCrawlStatus(req.params.jobId);
    res.json(status);
  } catch (error) {
    console.error('Crawl status endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Batch status endpoint
router.get('/batch/scrape/:id', authMiddleware, async (req, res) => {
  try {
    const result = await firecrawlAdapter.handleBatchStatus(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Batch status endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;