// src/utils/cleaner.js - optimized for speed with comprehensive formatting cleanup
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
    cookiesConsent: [],
    formatPatterns: {
      excessiveNewlines: /\n{3,}/g,                    // 3+ newlines
      tableSeparators: /\|[\s-]*\|[\s-]*\|/g,          // Table separators like | --- | --- |
      tableRows: /\| .+? \| .+? \|.*$/gm,              // Table rows with content
      escapeChars: /\\[_\\`']/g,                       // Escaped characters
      codeBlocks: /\|\s*\d+\s*(?:\d+\s*)*\s*\|/g,      // Code line numbers in docs
      markdownTags: /#+\s+/g,                          // Markdown headers
      documentationArtifacts: /\[\s*([^\]]+?)\s*\]\((?:[^)]+?)\)/g, // Markdown links
      typeAnnotations: /`[^`]+?`/g,                    // Inline code blocks
      trailingBackslashes: /\\$/gm,                    // Trailing backslashes
      pipeSequences: /\|+\s*\n/g,                      // Table row endings
      multiLinePipes: /\|[\s\S]*?\|[\s\S]*?\|/g,       // Multi-line table formatting
      anyTableLine: /^.*\|.*\|.*$/gm,                  // Any line with 2+ pipes
      functionCallsWithPipes: /.*\_[a-zA-Z0-9_]+.*\|.*$/gm, // Function calls with underscores and pipes
      pipeWithDashes: /.*\|\s*-{5,}\s*$/gm             // Lines ending with pipes and many dashes
    }
  };

  try {
    const rulesPath = path.join(__dirname, '../rules');
    
    // Load standard rules
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

    // Try to load formatting patterns, falling back to defaults
    let formatPatterns = {};
    try {
      formatPatterns = await fs.readFile(path.join(rulesPath, 'FORMAT_PATTERNS.json'), 'utf8')
        .then(JSON.parse)
        .catch(() => ({}));
    } catch (e) {
      // Use defaults if file doesn't exist or is invalid
    }

    // Merge with defaults, converting patterns to RegExp
    rules.formatPatterns = {};
    for (const [key, defaultPattern] of Object.entries(defaultRules.formatPatterns)) {
      const patternStr = formatPatterns[key] || defaultPattern.source;
      const flags = formatPatterns[`${key}Flags`] || defaultPattern.flags;
      rules.formatPatterns[key] = new RegExp(patternStr, flags);
    }
    
    rulesCache = rules;
    console.log('Rules loaded');
    return rules;
  } catch (error) {
    console.error('Error loading rules, using defaults:', error);
    return defaultRules;
  }
}
function cleanTableSeparators(content) {
    if (!content) return content;
    
    // Step 1: Remove lines that start with pipe followed by 30+ dashes or spaces
    // These are table separators
    let cleaned = content.replace(/^\|[\s-]{30,}.*$/gm, '');
    
    // Step 2: Remove lines with multiple pipes and 10+ dashes/spaces between them
    // These are table separators
    cleaned = cleaned.replace(/\|[\s-]{10,}\|[\s-]{10,}\|/g, '');
    
    // Step 3: Remove any line with 5+ pipe characters (very likely a table row)
    cleaned = cleaned.replace(/^.*(\|.*){5,}.*$/gm, '');
    
    // Step 4: Clean any line with code block line numbers (common in documentation)
    cleaned = cleaned.replace(/\|\s*\d+\s*(?:\d+\s*)*\s*\|/g, '');
    
    // Step 5: Clean code function references followed by pipes (common in API docs)
    cleaned = cleaned.replace(/.*\_[a-zA-Z0-9_]+\(\).*\|.*/g, '');
    
    return cleaned;
  }
  
/**
 * Cleans documentation formatting issues, especially tables and code formatting
 * @param {string} content - The markdown or HTML content to clean
 * @param {Object} rules - The formatting rules
 * @returns {string} - Cleaned content
 */
function cleanDocumentation(content, rules) {
  if (!content) return content;
  
  // Step 1: Remove any line with multiple pipe characters (3 or more)
  let cleaned = content.replace(rules.formatPatterns.anyTableLine, '');
  
  // Step 2: Remove lines with code method/function calls followed by pipes
  cleaned = cleaned.replace(rules.formatPatterns.functionCallsWithPipes, '');
  
  // Step 3: Remove escaped characters that appear in documentation
  cleaned = cleaned.replace(rules.formatPatterns.escapeChars, (match) => match.charAt(1));
  
  // Step 4: Clean trailing backslashes at end of lines
  cleaned = cleaned.replace(rules.formatPatterns.trailingBackslashes, '');
  
  // Step 5: Remove any line with pipes and many dashes
  cleaned = cleaned.replace(rules.formatPatterns.pipeWithDashes, '');
  
  // Step 6: Remove any remaining lines with excessive dashes or underscores
  cleaned = cleaned.replace(/^.*[-_]{10,}.*$/gm, '');
  
  // Step 7: Normalize excessive newlines created by our cleaning
  cleaned = cleaned.replace(rules.formatPatterns.excessiveNewlines, '\n\n');
  
  return cleaned;
}
function finalContentCleanup(content) {
    if (!content || typeof content !== 'string') return content;
  
    // 1. Remove any line with pipe character
    let cleaned = content.replace(/^.*\|.*$/gm, '');
    
    // 2. Remove any escaped backslashes
    cleaned = cleaned.replace(/\\+([\\`_])/g, '$1');
    
    // 3. Normalize excessive newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned;
  }
/**
 * Cleans text content by removing formatting artifacts
 * @param {string} textContent - The text to clean
 * @param {Object} rules - The formatting rules
 * @returns {string} - Cleaned text
 */
function cleanTextContent(textContent, rules) {
  if (!textContent || typeof textContent !== 'string') return '';
  
  // First apply documented-focused cleaning
  let cleaned = cleanDocumentation(textContent, rules);
  
  // Now apply general formatting cleanup
  
  // Clean markdown headers
  cleaned = cleaned.replace(rules.formatPatterns.markdownTags, '');
  
  // Convert documentation links to text
  cleaned = cleaned.replace(rules.formatPatterns.documentationArtifacts, '$1');
  
  // Remove type annotations
  cleaned = cleaned.replace(rules.formatPatterns.typeAnnotations, (match) => match.slice(1, -1));
  
  // Additional cleanup to prettify the text
  cleaned = cleaned
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Fix spacing around punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Fix paragraph spacing
    .replace(/\n\s+\n/g, '\n\n')
    // Remove empty lines at start and end
    .trim();
  
  return cleaned;
}

/**
 * High-performance content cleaner
 */
async function cleanContent(page, options = {}) {
  try {
    const { targetSelectors = [], removeSelectors = [] } = options;
    const preserveImages = options.remove_images === false;
    const cleanFormatting = options.clean_formatting !== false; // Default to true
    
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
    let cleanedHtml = await page.evaluate(() => {
      return document.body ? document.body.innerHTML : '';
    }).catch(() => '');

    // Apply text content formatting cleanup if enabled
    if (cleanFormatting && cleanedHtml) {
      try {
        // Clean in browser with aggressive document cleaning
        await page.evaluate((cleaningPatterns) => {
          // Helper function to clean table-like structures and formatting
          function cleanDocText(text) {
            if (!text || !text.trim()) return text;
            
            // Step 1: Remove any line with multiple pipe characters (2 or more)
            let cleaned = text.replace(new RegExp(cleaningPatterns.anyTableLine, 'gm'), '');
            
            // Step 2: Remove lines with code method/function calls followed by pipes
            cleaned = cleaned.replace(new RegExp(cleaningPatterns.functionCallsWithPipes, 'gm'), '');
            
            // Step 3: Remove escaped characters
            cleaned = cleaned.replace(new RegExp(cleaningPatterns.escapeChars, 'g'), (match) => match.charAt(1));
            
            // Step 4: Clean trailing backslashes
            cleaned = cleaned.replace(new RegExp(cleaningPatterns.trailingBackslashes, 'gm'), '');
            
            // Step 5: Remove lines with pipes and many dashes
            cleaned = cleaned.replace(new RegExp(cleaningPatterns.pipeWithDashes, 'gm'), '');
            
            // Step 6: Remove any lines with excessive dashes
            cleaned = cleaned.replace(/^.*[-_]{10,}.*$/gm, '');
            
            // Step 7: Normalize excessive newlines
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
            cleanedHtml = cleanTableSeparators(cleanedHtml);
            return cleaned;
          }
          
          // Process text nodes that contain pipe characters or escapes
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                return node.textContent && 
                  (node.textContent.includes('|') || 
                   node.textContent.includes('\\') ||
                   node.textContent.includes('_')) ? 
                  NodeFilter.FILTER_ACCEPT : 
                  NodeFilter.FILTER_REJECT;
              }
            },
            false
          );
          
          const nodesToClean = [];
          while (walker.nextNode()) {
            nodesToClean.push(walker.currentNode);
          }
          
          // Process each text node
          nodesToClean.forEach(node => {
            node.textContent = cleanDocText(node.textContent);
          });
          
          return document.body.innerHTML;
        }, {
          anyTableLine: rules.formatPatterns.anyTableLine.source,
          functionCallsWithPipes: rules.formatPatterns.functionCallsWithPipes.source,
          escapeChars: rules.formatPatterns.escapeChars.source,
          trailingBackslashes: rules.formatPatterns.trailingBackslashes.source,
          pipeWithDashes: rules.formatPatterns.pipeWithDashes.source
        })
        .then(result => {
          if (result) {
            cleanedHtml = result;
          }
        })
        .catch(e => console.error('Browser cleaning error:', e));
        
        // Final pass with server-side cleaning
        cleanedHtml = cleanTextContent(cleanedHtml, rules);

        cleanedHtml = finalContentCleanup(cleanedHtml);

      } catch (e) {
        console.error('Error in formatting cleanup:', e);
        // Continue with the already cleaned HTML if cleanup fails
      }
    }

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