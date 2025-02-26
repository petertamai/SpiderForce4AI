// src/utils/browser-manager.js
const puppeteer = require('puppeteer');
const { addExtra } = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.activePages = new Set();
    this.pageSessions = new Map();
    this.maxConcurrentPages = 10;
    this.pageTimeout = 10000; // 10 seconds
  }

  async getBrowser() {
    if (this.browser) {
      try {
        // Test if browser is still responsive
        await this.browser.pages();
        return this.browser;
      } catch (error) {
        console.log('Browser became unresponsive, reinitializing...');
        this.browser = null;
        this.isInitializing = false;
      }
    }

    if (this.isInitializing) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this._initBrowser();
    return this.initPromise;
  }

  async _initBrowser() {
    try {
      const puppeteerExtra = addExtra(puppeteer);
      puppeteerExtra.use(StealthPlugin());
      puppeteerExtra.use(AdblockerPlugin({ 
        blockTrackers: true,
        interceptResolutionPriority: 100
      }));
      puppeteerExtra.use(RecaptchaPlugin());

      this.browser = await puppeteerExtra.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-audio-output',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-popup-blocking',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-speech-api',
          '--disable-sync',
          '--disable-translate',
          '--disable-voice-input',
          '--disable-wake-on-wifi',
          '--disable-webgl',
          '--disable-webgl2',
          '--ignore-certificate-errors',
          '--no-default-browser-check',
          '--no-experiments',
          '--no-first-run',
          '--no-pings',
          '--mute-audio',
         // '--disable-javascript',
         // '--blink-settings=imagesEnabled=false',
          '--disable-remote-fonts',
         //exata
         //safe
         /*
        '--no-zygote',
         '--js-flags=--max-old-space-size=512',  // Removed quotes and --expose-gc for stability
        '--aggressive-cache-discard',
        '--enable-aggressive-domstorage-flushing',
        '--disable-partial-raster',
        '--disable-threaded-animation',
        '--enable-low-end-device-mode',
        '--disable-reading-from-canvas',
        '--disable-databases',
        '--disable-webrtc',
        '--disable-site-isolation-trials',
        '--max-active-webgl-contexts=0',
        '--enable-fast-unload',
        '--proxy-bypass-list=*',
        '--disable-features=MediaRouter,TranslateUI',
         '--disable-databases',
         '--disable-backgrounding-occluded-windows',
         */
         //all
      
        '--no-zygote',
        '--js-flags="--max-old-space-size=512 --expose-gc"',
        '--aggressive-cache-discard',
        '--disable-backgrounding-occluded-windows',
        '--enable-aggressive-domstorage-flushing',
        '--disable-renderer-code-integrity',
        //'--renderer-startup-dialog',
        '--process-per-tab',
        '--disable-partial-raster',
        '--disable-zero-copy',
        '--disable-threaded-scrolling',
        '--disable-threaded-animation',
        '--enable-low-end-device-mode',
        '--disable-reading-from-canvas',
        '--disable-gesture-typing',
        '--disable-composited-antialiasing',
        '--disable-databases',
        '--disable-pepper-3d',
        '--disable-webrtc',
        '--disable-image-animation-resync',
        '--disable-save-password-bubble',
        '--disable-permission-bubbles',
        '--disable-site-isolation-trials',
        '--disable-bundled-ppapi-flash',
        '--max-active-webgl-contexts=0',
        '--enable-fast-unload',
        '--proxy-bypass-list=*',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-features=MediaRouter,TranslateUI',
        

        ]
      });

      // Set up disconnection handler
      this.browser.on('disconnected', async () => {
        console.log('Browser disconnected, cleaning up...');
        this.browser = null;
        this.isInitializing = false;
        await this.cleanup();
      });

      console.log('Browser instance created and ready');
      this.isInitializing = false;
      return this.browser;
    } catch (error) {
      console.error('Browser initialization error:', error);
      this.isInitializing = false;
      throw error;
    }
  }

  async _setupPageRequestInterception(page) {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url().toLowerCase();
  
      // For images, abort the actual resource load but preserve the DOM structure
      if (resourceType === 'image') {
        request.abort();
        return;
      }
  
      // Abort JavaScript files with "cookies" in the file name
      if (resourceType === 'script') {
        try {
          const parsedUrl = new URL(request.url());
          const fileName = parsedUrl.pathname.split('/').pop().toLowerCase();
          if (fileName.includes('cookie')) {
            console.log(`[${url}] Aborting script request: ${request.url()}`);
            request.abort();
            return;
          }
        } catch (e) {
          console.error('Error parsing URL for script:', request.url(), e);
        }
      }
  
      // Block other unnecessary resources
      const blockTypes = [
        'font', 'texttrack', 'object',
        'beacon', 'csp_report', 'imageset',
        'ping', 'manifest'
      ];
  
      if (blockTypes.includes(resourceType)) {
        request.abort();
        return;
      }
  
      // Block by domain (analytics, ads, etc.)
      const blockDomains = [
        'google-analytics', 'doubleclick.net', 'facebook',
        'googleadservices', 'googletagmanager', 'google-analytics',
        'googlesyndication', 'adnxs.com', 'advertising.com',
        'cdn.onthe.io', 'taboola.com', 'hotjar.com',
        'analytics', 'tracker', 'tracking', 'metrics',
        'adserver', 'pixel', 'collect'
      ];
  
      if (blockDomains.some(domain => url.includes(domain))) {
        request.abort();
        return;
      }
  
      // Block by file extension (except images)
      const blockExtensions = [
        '.mp4', '.webm', '.ogg', '.mp3', '.wav',
        '.ttf', '.woff', '.woff2', '.eot', '.otf',
        '.css', '.scss', '.less', '.pdf',
        '.zip', '.tar', '.gz', '.ico', '.cur'
      ];
  
      if (blockExtensions.some(ext => url.endsWith(ext))) {
        request.abort();
        return;
      }
  
      request.continue();
    });
  }

  async createPage() {
    if (this.activePages.size >= this.maxConcurrentPages) {
      throw new Error('Maximum concurrent pages limit reached');
    }

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    this.activePages.add(page);

    try {
      // Create CDP session
      const client = await page.target().createCDPSession();
      this.pageSessions.set(page, client);

      // Set viewport
      await page.setViewport({ width: 1024, height: 768 });

      // Setup request interception
      await this._setupPageRequestInterception(page);

      // Disable JavaScript features
      await page.evaluateOnNewDocument(() => {
        window.alert = () => {};
        window.confirm = () => true;
        window.prompt = () => null;
        const noop = () => {};
        ['log', 'debug', 'info', 'warn', 'error'].forEach(method => {
          console[method] = noop;
        });
      });

      // Set headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });

      // Set timeouts
      await page.setDefaultNavigationTimeout(this.pageTimeout);
      await page.setDefaultTimeout(this.pageTimeout);

      // Enable JS console coverage
      await client.send('Console.enable');

      // Block all dialogs
      page.on('dialog', async dialog => {
        await dialog.dismiss();
      });
      
      return page;
    } catch (error) {
      await this.closePage(page).catch(() => {});
      throw error;
    }
  }

  async closePage(page) {
    if (!page || !this.activePages.has(page)) {
      return;
    }

    try {
      // Remove all listeners
      page.removeAllListeners();
      
      // Get and clean up CDP session
      const client = this.pageSessions.get(page);
      if (client) {
        await Promise.all([
          client.send('Network.clearBrowserCache').catch(() => {}),
          client.send('Network.clearBrowserCookies').catch(() => {}),
          client.detach().catch(() => {})
        ]);
        this.pageSessions.delete(page);
      }

      // Close page
      this.activePages.delete(page);
      await page.close().catch(() => {});
    } catch (error) {
      console.error('Error closing page:', error);
    }
  }

  async cleanup() {
    try {
      // Close all active pages
      await Promise.all(
        Array.from(this.activePages).map(page => this.closePage(page))
      );
      
      // Close browser
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }

      // Clear all collections
      this.activePages.clear();
      this.pageSessions.clear();
      this.isInitializing = false;
      this.initPromise = null;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async navigateToUrl(page, url) {
    try {
      console.log('\x1b[36m%s\x1b[0m', `🌐 Navigating to: ${url}`);  // Cyan color
      const startTime = Date.now();
      
      await Promise.race([
        page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: this.pageTimeout
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Navigation timeout')), this.pageTimeout)
        )
      ]);

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;  // Convert to seconds
      console.log('\x1b[32m%s\x1b[0m', `✅ Successfully loaded: ${url} (${duration.toFixed(2)}s)`);  // Green color
      
      // Get and log the final URL (in case of redirects)
      const finalUrl = page.url();
      if (finalUrl !== url) {
        console.log('\x1b[33m%s\x1b[0m', `↪️ Redirected to: ${finalUrl}`);  // Yellow color
      }

    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Failed to load ${url}: ${error.message}`);  // Red color
      throw new Error(`Navigation failed: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new BrowserManager();