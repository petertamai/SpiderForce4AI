// src/utils/converter.js
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');

/**
 * Convert HTML to Markdown
 * @param {string} html - HTML content to convert
 * @param {Object} options - Conversion options
 * @returns {string} - Markdown content
 */
async function convertToMarkdown(html, options = {}) {
  // ULTRA AGGRESSIVE PIPE TABLE CLEANUP - apply this immediately
  // This should happen BEFORE TurndownService gets the content
  if (html && typeof html === 'string') {
    // First pass - remove any line with a pipe character completely
    html = html.replace(/^.*\|.*$/gm, '');
    
    // Second pass - handle any that got missed in multi-line content
    html = html.replace(/\|[\s\S]*?\|/g, '');
    
    // Clean leftover escaped characters
    html = html.replace(/\\([_\\`'])/g, '$1');
  }
  
  try {
    // Configure TurndownService with options
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      hr: '---'
    });
    
    // Use GitHub Flavored Markdown plugin
    turndownService.use(gfm);
    
    // Custom rules
    // Remove empty links
    turndownService.addRule('removeEmptyLinks', {
      filter: (node, options) => {
        return (
          node.nodeName === 'A' &&
          (!node.textContent.trim() || node.textContent.trim() === '#')
        );
      },
      replacement: function(content, node, options) {
        return '';
      }
    });
    
    // Handle images
    turndownService.addRule('handleImages', {
      filter: 'img',
      replacement: function(content, node) {
        // Skip image processing if remove_images is true
        if (options.remove_images === true) {
          return '';
        }
        
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        
        // Skip empty or placeholder images
        if (!src || 
           src.includes('blank.gif') || 
           src.includes('placeholder') || 
           src.includes('spacer') || 
           src.includes('1x1.gif') ||
           src.includes('pixel') ||
           src.includes('transparent')) {
          return '';
        }
        
        return `![${alt}](${src})`;
      }
    });
    
    // Handle code blocks
    turndownService.addRule('codeBlocks', {
      filter: function(node, options) {
        return (
          node.nodeName === 'PRE' &&
          node.firstChild &&
          node.firstChild.nodeName === 'CODE'
        );
      },
      replacement: function(content, node, options) {
        const code = node.firstChild.textContent || '';
        const lang = node.firstChild.className || '';
        const langMatch = lang.match(/language-(\w+)/);
        const language = langMatch ? langMatch[1] : '';
        
        return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      }
    });
    
    // Handle tables for GFM
    turndownService.addRule('tables', {
      filter: 'table',
      replacement: function(content, node) {
        // If the table contains complex formatting or is very large, 
        // it might be better to just remove it
        const rows = node.rows;
        if (rows.length > 20 || content.includes('|---')) {
          return '\n\n';
        }
        
        // Otherwise, let the gfm plugin handle it
        return content;
      }
    });
    
    // Remove script/style tags and their content
    turndownService.remove(['script', 'style', 'iframe', 'noscript', 'canvas', 'svg']);
    
    // Convert HTML to Markdown
    let markdown = turndownService.turndown(html);
    
    // Post-processing of markdown
    
    // Remove consecutive blank lines (more than 2)
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    
    // Fix code block formatting issues
    markdown = markdown.replace(/`{3,}(\w*)\n\n+/g, '```$1\n');
    markdown = markdown.replace(/\n\n+`{3,}/g, '\n```');
    
    // Clean up escaped links
    markdown = markdown.replace(/\\\[(.*?)\\\]\((.*?)\)/g, '[$1]($2)');
    
    // Extra cleaning for any pipe characters that might have been missed
    markdown = markdown.replace(/^.*\|.*$/gm, '');
    
    return markdown;
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    
    // Fallback: return a basic text version if conversion fails
    let textContent = '';
    try {
      // Create a temporary div to extract text
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM(html);
      textContent = dom.window.document.body.textContent || '';
      
      // Clean up the text content
      textContent = textContent.replace(/\s+/g, ' ').trim();
    } catch (e) {
      console.error('Fallback text extraction failed:', e);
      textContent = 'Error converting content to markdown.';
    }
    
    return textContent;
  }
}

module.exports = { convertToMarkdown };