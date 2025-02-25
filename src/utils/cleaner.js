// src/utils/cleaner.js - optimized for speed with full rule execution
const fs = require('fs').promises;
const path = require('path');

// Cache rules to avoid repeated file reads
let rulesCache = null;

/**
 * Efficiently load rules with caching
 */
async function loadRules() {
  if (rulesCache) return rulesCache;
  
  const defaultRules = {
    headerFooterTags: [],
    headerFooterClasses: [],
    headerFooterIds: [],
    containsInClassOrId: [],
    cookiesConsent: []
  };

  try {
    const rulesPath = path.join(__dirname, '../rules');
    const rules = {
      headerFooterTags: await fs.readFile(path.join(rulesPath, 'HEADER_FOOTER_TAGS.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => defaultRules.headerFooterTags),
      headerFooterClasses: await fs.readFile(path.join(rulesPath, 'HEADER_FOOTER_CLASSES.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => defaultRules.headerFooterClasses),
      headerFooterIds: await fs.readFile(path.join(rulesPath, 'HEADER_FOOTER_IDS.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => defaultRules.headerFooterIds),
      containsInClassOrId: await fs.readFile(path.join(rulesPath, 'CONTAINS_IN_CLASS_OR_ID.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => defaultRules.containsInClassOrId),
      cookiesConsent: await fs.readFile(path.join(rulesPath, 'cookies_consent.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => defaultRules.cookiesConsent)
    };
    
    rulesCache = rules;
    console.log('Rules loaded');
    return rules;
  } catch (error) {
    console.error('Error loading rules, using defaults:', error);
    return defaultRules;
  }
}

/**
 * High-performance content cleaner
 */
async function cleanContent(page, options = {}) {
  try {
    const { targetSelectors = [], removeSelectors = [] } = options;
    const preserveImages = options.remove_images === false;
    
    // Fast path for aggressive_cleaning=false
    if (options.aggressive_cleaning === false) {
      return await page.evaluate(() => document.body.innerHTML);
    }
    
    console.log('Starting content cleaning');
    
    // Load rules with fallbacks
    const rules = await loadRules();
    
    // Extract content if target selectors are provided
    if (targetSelectors.length > 0) {
      try {
        await page.evaluate((selectors) => {
          try {
            const getContent = (selector) => {
              try {
                const elements = document.querySelectorAll(selector);
                return elements.length === 0 ? '' : Array.from(elements).map(el => el.outerHTML).join('\n');
              } catch (e) {
                return '';
              }
            };

            const allContent = selectors
              .map(getContent)
              .filter(content => content.length > 0)
              .join('\n');

            if (allContent) {
              const wrapper = document.createElement('div');
              wrapper.className = 'content-wrapper';
              wrapper.innerHTML = allContent;
              document.body.innerHTML = wrapper.outerHTML;
            }
          } catch (e) {}
        }, targetSelectors).catch(() => {});
      } catch (e) {}
    }

    // The key cleaning function with image preservation
    await page.evaluate((config) => {
      // Simplified and optimized element removal
      const safelyRemoveElements = (elements, isImageSelector = false) => {
        try {
          if (!elements || !elements.length) return;
          
          // Fast path if we don't need to preserve images
          if (!config.preserveImages) {
            Array.from(elements).forEach(el => el.remove());
            return;
          }
          
          // Skip if this is an image selector and we're preserving images
          if (isImageSelector) return;
          
          Array.from(elements).forEach(el => {
            // Don't remove img tags
            if (el.tagName === 'IMG') return;
            
            // Check if element has img children before removal
            if (el.querySelector('img')) {
              // Special case: Try to keep the images by moving them outside
              const imgs = el.querySelectorAll('img');
              if (imgs.length > 0) {
                const parent = el.parentNode;
                if (parent) {
                  // Move images to parent element before removing this element
                  Array.from(imgs).forEach(img => parent.insertBefore(img.cloneNode(true), el));
                }
              }
            }
            
            // Now safe to remove
            el.remove();
          });
        } catch (e) {}
      };

      // CRITICAL: This function must keep executing for all rules
      const executeAllRules = () => {
        // 1. Tag-based removal
        if (config.tagSelectors && config.tagSelectors.length) {
          config.tagSelectors.forEach(tag => {
            const isImgTag = tag.toLowerCase() === 'img';
            const elements = document.getElementsByTagName(tag);
            safelyRemoveElements(elements, isImgTag);
          });
        }

        // 2. Class-based removal
        if (config.classSelectors && config.classSelectors.length) {
          config.classSelectors.forEach(className => {
            const elements = document.getElementsByClassName(className);
            safelyRemoveElements(elements);
          });
        }

        // 3. ID-based removal
        if (config.idSelectors && config.idSelectors.length) {
          config.idSelectors.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
              if (config.preserveImages && (element.tagName === 'IMG' || element.querySelector('img'))) {
                // If preserving images and element is/has images, handle specially
                if (element.querySelector('img')) {
                  const parent = element.parentNode;
                  if (parent) {
                    const imgs = element.querySelectorAll('img');
                    Array.from(imgs).forEach(img => parent.insertBefore(img.cloneNode(true), element));
                  }
                }
                if (element.tagName !== 'IMG') {
                  element.remove();
                }
              } else {
                element.remove();
              }
            }
          });
        }

        // 4. Pattern-based removal - this is critical for most rules
        try {
          const allElements = document.getElementsByTagName('*');
          const patterns = config.containsPatterns || [];
          
          if (patterns.length > 0) {
            Array.from(allElements).forEach(element => {
              try {
                // Skip img tags if preserving images
                if (config.preserveImages && element.tagName === 'IMG') return;
                
                const classNames = (element.className || '').toString().toLowerCase();
                const id = (element.id || '').toString().toLowerCase();
                
                const matchesPattern = patterns.some(pattern => {
                  const lowerPattern = pattern.toLowerCase();
                  return classNames.includes(lowerPattern) || id.includes(lowerPattern);
                });

                if (matchesPattern) {
                  if (config.preserveImages && element.querySelector('img')) {
                    // Handle images before removal
                    const parent = element.parentNode;
                    if (parent) {
                      const imgs = element.querySelectorAll('img');
                      Array.from(imgs).forEach(img => parent.insertBefore(img.cloneNode(true), element));
                    }
                  }
                  element.remove();
                }
              } catch (e) {}
            });
          }
        } catch (e) {}

        // 5. Cookie consent removal
        if (config.cookieSelectors && config.cookieSelectors.length) {
          config.cookieSelectors.forEach(selector => {
            try {
              const elements = document.querySelectorAll(selector);
              safelyRemoveElements(elements);
            } catch (e) {}
          });
        }

        // 6. Custom selector removal
        if (config.customSelectors && config.customSelectors.length) {
          config.customSelectors.forEach(selector => {
            try {
              const isImgSelector = selector.toLowerCase().includes('img');
              const elements = document.querySelectorAll(selector);
              safelyRemoveElements(elements, isImgSelector);
            } catch (e) {}
          });
        }

        // 7. Simplified empty element cleanup
        const removeEmptyElements = (element) => {
          if (!element || !element.children || element.children.length === 0) return;
          
          // Shallow copy to avoid modification during iteration
          const children = Array.from(element.children);
          children.forEach(child => {
            if (config.preserveImages && (child.tagName === 'IMG' || child.querySelector('img'))) {
              // Skip image elements
              return;
            }
            
            removeEmptyElements(child);
            
            if (child.children.length === 0 && 
                (!child.textContent || !child.textContent.trim()) &&
                !(config.preserveImages && child.tagName === 'IMG')) {
              child.remove();
            }
          });
        };

        try {
          if (document.body) {
            removeEmptyElements(document.body);
          }
        } catch (e) {}
      };
      
      // Execute all rules
      executeAllRules();
      
    }, {
      tagSelectors: rules.headerFooterTags,
      classSelectors: rules.headerFooterClasses,
      idSelectors: rules.headerFooterIds,
      containsPatterns: rules.containsInClassOrId,
      cookieSelectors: rules.cookiesConsent,
      customSelectors: removeSelectors,
      preserveImages: preserveImages
    }).catch(e => console.error('Error in page evaluation:', e));

    // Get final HTML
    const cleanedHtml = await page.evaluate(() => {
      return document.body ? document.body.innerHTML : '';
    }).catch(() => '');

    console.log('Content cleaning completed');
    return cleanedHtml;

  } catch (error) {
    console.error('Error in content cleaning process:', error);
    // Never fail - return whatever HTML we have
    try {
      return await page.evaluate(() => document.body.innerHTML).catch(() => '');
    } catch (e) {
      return '';
    }
  }
}

module.exports = { cleanContent };