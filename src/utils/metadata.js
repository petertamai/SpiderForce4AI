async function extractMetadata(page) {
  try {
    const metadata = await page.evaluate(() => {
      const getMetaContent = (name) => {
        const element = document.querySelector(`meta[name="${name}"]`) || 
                       document.querySelector(`meta[property="${name}"]`);
        return element ? element.content : null;
      };

      return {
        title: document.title || '',
        description: getMetaContent('description') || getMetaContent('og:description'),
        keywords: getMetaContent('keywords'),
        author: getMetaContent('author'),
        ogTitle: getMetaContent('og:title'),
        ogType: getMetaContent('og:type'),
        ogImage: getMetaContent('og:image'),
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        language: document.documentElement.lang || '',
      };
    });

    return Object.fromEntries(
      Object.entries(metadata).filter(([_, value]) => value)
    );
  } catch (error) {
    console.error('Metadata extraction error:', error);
    return {};
  }
}

function formatMetadata(metadata) {
  return Object.entries(metadata)
    .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
    .join('\n');
}

module.exports = { extractMetadata, formatMetadata };
