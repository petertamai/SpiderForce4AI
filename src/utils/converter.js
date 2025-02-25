// src/utils/converter.js - with placeholder image handling
const { NodeHtmlMarkdown } = require('node-html-markdown');
const fs = require('fs').promises;
const path = require('path');

// Cache for regex patterns
let regexCache = null;

async function loadMarkdownRegexes() {
  if (regexCache) return regexCache;
  
  try {
    const regexesPath = path.join(__dirname, '../config/markdown-regexes.json');
    regexCache = JSON.parse(await fs.readFile(regexesPath, 'utf8'));
    return regexCache;
  } catch (error) {
    console.error('Error loading markdown regexes:', error);
    regexCache = {};
    return regexCache;
  }
}

// Precompiled regex patterns cache
const compiledRegexes = {};

async function convertToMarkdown(html, options = {}) {
  try {
    //console.log('Starting HTML to Markdown conversion');
    
    // Initial conversion
    const markdown = NodeHtmlMarkdown.translate(html, {
      bulletMarker: '*',
      codeBlockStyle: 'fenced'
    });

    // Fast path for aggressive_cleaning=false
    if (options.aggressive_cleaning === false) {
      return markdown;
    }

    // Load regexes
    const regexes = await loadMarkdownRegexes();
    //console.log('Applying markdown cleaning rules in order');

    // Apply regexes in order
    let cleanedMarkdown = markdown;
    for (const [ruleName, pattern] of Object.entries(regexes)) {
      try {
        // Skip image-related rules if preserve images is enabled
        // But still process replace_placeholder_images
        if (options.remove_images === false && 
            ruleName.includes('image') && 
            ruleName !== 'replace_placeholder_images') {
          continue;
        }
        
        // Use cached compiled regex or compile and cache it
        if (!compiledRegexes[ruleName]) {
          compiledRegexes[ruleName] = new RegExp(pattern, 'gm');
        }
        const regex = compiledRegexes[ruleName];
        
        // Special case for placeholder images
        if (ruleName === 'replace_placeholder_images') {
          cleanedMarkdown = cleanedMarkdown.replace(regex, (match, altText) => {
            // Extract alt text if available and create a marker
            const imageLabel = altText ? altText.trim() : 'Image';
            return `[;PLACEHOLDER_IMAGE: ${imageLabel}]`;
          });
          continue;
        }
        
        switch(ruleName) {
          case 'double_empty_lines':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '\n');
            break;
            
          case 'line_breaks_before_headers':
          case 'list_items_followed_by_bracket':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '$1\n\n$2');
            break;
            
          case 'markdown_images':
          case 'markdown_links_or_images':
          case 'headers_with_markdown_links':
          case 'empty_headers':
          case 'empty_hash':
          case 'remove_asterisks':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '');
            break;
            
          case 'adjacent_links':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '$1 $2');
            break;
            
          case 'markdown_links_starting_with_hash':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '$1');
            break;
            
          case 'extra_lines':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '\n\n');
            break;
            
          case 'empty_markdown_links':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '');
            break;
            
          case 'content_followed_by_dashes':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '\n$1$2');
            break;
            
          case 'clean_links':
          case 'fix_missing_bracket':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '[$1]($2)');
            break;
            
          case 'remove_outer_link':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '[$1]($2)');
            break;
            
          case 'link_followed_by_text_and_equals':
            cleanedMarkdown = cleanedMarkdown.replace(regex, '$1\n\n$2\n$3');
            break;
            
          case 'relative_url_link':
            cleanedMarkdown = cleanedMarkdown.replace(regex, (match, p1) => {
              const brandName = p1.split('/').pop();
              const capitalizedBrandName = brandName.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              return `[${capitalizedBrandName}](${p1})`;
            });
            break;
            
          default:
            cleanedMarkdown = cleanedMarkdown.replace(regex, '');
        }
      } catch (error) {
        console.error(`Error applying rule ${ruleName}:`, error);
      }
    }

    // Final cleanup
    cleanedMarkdown = cleanedMarkdown
      .replace(/^\s+|\s+$/g, '')  // Trim start and end
      .replace(/\n\s*\n\s*\n/g, '\n\n')  // Remove multiple blank lines
      .replace(/(\[.*?\]\(.*?)\)+/g, '$1)') // Fix multiple closing parentheses
      .trim();

    //console.log('Markdown conversion and cleaning completed');
    return cleanedMarkdown;
  } catch (error) {
    console.error('Error in markdown conversion:', error);
    throw error;
  }
}

module.exports = { convertToMarkdown };