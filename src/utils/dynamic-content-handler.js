// src/utils/dynamic-content-handler.js
// A utility for ensuring dynamic content is fully loaded before extraction
/**
 * Helper module for handling dynamic content loading
 * Provides functionality to ensure content is fully loaded before extraction
 */

/**
 * Scrolls to bottom of page and waits for content to settle
 * @param {Object} page - Puppeteer page object
 * @param {Number} waitTime - Time to wait after scrolling (ms)
 * @param {Number} scrollSteps - Number of incremental scroll steps
 */
async function scrollToBottom(page, waitTime = 200, scrollSteps = 5) {
    try {
      console.log('\x1b[33m%s\x1b[0m', `🔄 Scrolling page to load dynamic content...`);
      
      // Get page height
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      
      // Calculate step size
      const stepSize = Math.max(Math.floor(bodyHeight / scrollSteps), viewportHeight);
      
      // Perform incremental scrolling
      for (let i = 0; i < scrollSteps; i++) {
        const scrollTo = stepSize * (i + 1);
        await page.evaluate((scrollPos) => {
          window.scrollTo(0, scrollPos);
        }, scrollTo);
        
        // Wait between scrolls to allow content to load
        await page.evaluate(timeout => {
          return new Promise(resolve => setTimeout(resolve, timeout));
        }, waitTime / scrollSteps);
      }
      
      // Final scroll to bottom and wait
      await page.evaluate((timeout) => {
        window.scrollTo(0, document.body.scrollHeight);
        return new Promise(resolve => setTimeout(resolve, timeout));
      }, waitTime);
      console.log('\x1b[32m%s\x1b[0m', `✅ Page scrolled, waiting for dynamic content`);
    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Error during page scrolling: ${error.message}`);
    }
  }
  
  /**
   * Waits for a specified selector to be visible on the page
   * @param {Object} page - Puppeteer page object
   * @param {String} selector - CSS selector to wait for
   * @param {Number} timeout - Maximum time to wait (ms)
   * @returns {Boolean} - Whether the selector was found
   */
  async function waitForContentSelector(page, selector, timeout = 5000) {
    try {
      await page.waitForSelector(selector, { 
        visible: true, 
        timeout 
      });
      return true;
    } catch (error) {
      console.warn(`Selector "${selector}" not found or not visible within timeout`);
      return false;
    }
  }
  
  /**
   * Attempts to ensure dynamic content is fully loaded
   * @param {Object} page - Puppeteer page object
   * @param {Object} options - Configuration options
   * @returns {Boolean} - Whether the operation was successful
   */
  async function ensureDynamicContentLoaded(page, options = {}) {
    try {
      const { 
        waitTime = 200,
        extraWaitTime = 1000,
        targetSelectors = []
      } = options;
      
      // First attempt to wait for specific selectors if provided
      if (targetSelectors && targetSelectors.length > 0) {
        // Try each selector - just need one to succeed
        const selectorPromises = targetSelectors.map(selector => 
          waitForContentSelector(page, selector)
        );
        
        // Wait for any selector to be found (with timeout)
        const results = await Promise.all(selectorPromises);
        const anyFound = results.some(found => found);
        
        if (anyFound) {
          console.log('\x1b[32m%s\x1b[0m', `✅ Target content selectors found`);
        } else {
          console.log('\x1b[33m%s\x1b[0m', `⚠️ No target selectors found, continuing with scroll strategy`);
        }
      }
      
      // Only scroll if we need to (content is below threshold or we're explicitly asked to)
      if (options.forceScroll === true) {
        await scrollToBottom(page, waitTime);
        
        // Allow extra time for any final rendering
        await page.evaluate(timeout => {
          return new Promise(resolve => setTimeout(resolve, timeout));
        }, extraWaitTime);
      }
      
      return true;
    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Error while ensuring dynamic content: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Estimates the content richness of a page
   * @param {Object} page - Puppeteer page object
   * @returns {Object} - Content statistics (textLength, elementCount)
   */
  async function evaluateContentRichness(page) {
    try {
      return await page.evaluate(() => {
        // Get all text nodes that are visible
        const textContent = document.body.innerText || '';
        const textLength = textContent.length;
        
        // Count significant elements (paragraphs, divs with content, etc.)
        const paragraphs = document.querySelectorAll('p').length;
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
        const contentDivs = document.querySelectorAll('div:not(:empty)').length;
        const links = document.querySelectorAll('a').length;
        const images = document.querySelectorAll('img').length;
        
        // Total significant element count
        const elementCount = paragraphs + headings + contentDivs + links + images;
        
        return {
          textLength,
          elementCount,
          paragraphs,
          headings,
          contentDivs,
          links,
          images
        };
      });
    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Error evaluating content richness: ${error.message}`);
      return { textLength: 0, elementCount: 0 };
    }
  }
  
  module.exports = {
    scrollToBottom,
    waitForContentSelector,
    ensureDynamicContentLoaded,
    evaluateContentRichness
  };