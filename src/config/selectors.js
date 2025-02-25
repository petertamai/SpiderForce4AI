const defaultSelectors = {
    removeSelectors: [
      // Navigation elements
      'nav', '.navigation', '#menu', '.menu', 
      // Headers and footers
      'header', 'footer', '.header', '.footer',
      // Cookie notices
      '.cookie-banner', '#cookie-notice', '.gdpr',
      // Ads and social media
      '.advertisement', '.social-media', '.share-buttons',
      // Comments
      '#comments', '.comments-section', '.comment-form',
      // Sidebars
      '.sidebar', '#sidebar', '.widget-area',
      // Other common elements to remove
      '.skip-link', '.breadcrumb', '.pagination'
    ]
  };
  
  module.exports = { defaultSelectors };