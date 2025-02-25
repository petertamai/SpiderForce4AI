// src/utils/performance.js
const v8 = require('v8');
const { performance } = require('perf_hooks');

class PerformanceOptimizer {
  constructor() {
    // Configure V8 heap settings
    v8.setFlagsFromString('--max-old-space-size=512');
    v8.setFlagsFromString('--optimize-for-size');
    
    this.metricsInterval = null;
    this.lastGC = Date.now();
    this.gcInterval = 60000; // 1 minute
  }

  // Memory monitoring and garbage collection
  startMemoryMonitoring() {
    this.metricsInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      
      // Force GC if heap usage is high
      if (memoryUsage.heapUsed > 384 * 1024 * 1024) { // 384MB
        if (Date.now() - this.lastGC >= this.gcInterval) {
          if (global.gc) {
            global.gc();
            this.lastGC = Date.now();
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Page optimization wrapper
  async optimizePage(page) {
    await page.setJavaScriptEnabled(true);
    
    // Set minimal viewport
    await page.setViewport({
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
    });

    // Disable unnecessary features
    await page.evaluateOnNewDocument(() => {
      // Disable console logging
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
      
      // Disable animations
      window.requestAnimationFrame = cb => setTimeout(cb, 0);
      
      // Minimize timer resolution
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = (fn, delay, ...args) => {
        return originalSetTimeout(fn, Math.max(delay, 4), ...args);
      };
    });

    // Cache DNS
    await page.setExtraHTTPHeaders({
      'DNT': '1',
      'Upgrade-Insecure-Requests': '1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    });

    return page;
  }

  // Measure execution time
  async measureExecution(fn, name) {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      if (duration > 1000) { // Log slow operations
        console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    }
  }
}

module.exports = new PerformanceOptimizer();