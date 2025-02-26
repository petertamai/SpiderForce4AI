# SpiderForce4AI 🚀

**The fastest HTML to Markdown converter for AI data collection. Period.**

![Average Processing Time](https://raw.githubusercontent.com/petertamai/SpiderForce4AI/main/assets/benchmark-avg.png)

**3.45× faster than Jina AI, 3.45× faster than Firecrawl** - Benchmark results don't lie. SpiderForce4AI delivers lightning-fast content extraction while maintaining higher quality output.

A NodeJS-native web crawler built specifically for AI training data collection, RAG (Retrieval-Augmented Generation), and SEO analysis. This isn't just another crawler - it's a purpose-built tank that always delivers, with Formula 1 speed.

> "It does what it takes and cuts out unnecessary bs."

## Run in 30 Seconds

```bash
docker run -d --restart unless-stopped -p 3004:3004 --name spiderforce4ai petertamai/spiderforce4ai:latest
```

Then just call:
```bash
curl "http://localhost:3004/convert?url=https://example.com"
```

**Deploy to DigitalOcean** with one click:  
[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/petertamai/SpiderForce4AI/tree/main)

## Why SpiderForce4AI Exists

I've been building web scrapers since 2010, and every year the challenges multiply: JavaScript frameworks, anti-bot systems, complex DOM structures, cookie banners - you name it.

But here's the truth: **web crawling doesn't have to be expensive or complicated**. While solutions like Jina.ai and Firecrawl offer great features, they come with hefty price tags or limitations.

So I built SpiderForce4AI - **a NodeJS-native crawler** (not Python wrapped in API calls) that delivers:
- ⚡ **Raw Speed**: 3.45× faster than competitors (see benchmarks)
- 🧠 **AI-Optimized Output**: Clean, structured markdown perfect for LLMs
- 🛡️ **Tank-Like Reliability**: 3-stage fallback ensures content is always extracted
- 💰 **Cost-Effective**: Run on a $10/month VPS (2GB RAM, 2 cores)
- 🔌 **Drop-In Integration**: Works with any LLM platform or automation tool
- 🎯 **Precision Targeting**: Extract exactly what you need

<details>
<summary><strong>🏎️ Performance Benchmarks</strong></summary>

![Crawling Time Comparison](https://raw.githubusercontent.com/petertamai/SpiderForce4AI/main/assets/benchmark-detail.png)

**Average Processing Times:**
- SpiderForce4AI: 1.69s
- Jina AI: 3.49s
- Firecrawl: 5.83s

These benchmarks were run against 30 diverse websites, from simple blogs to complex JavaScript applications. SpiderForce4AI consistently outperformed competitors, especially on dynamic content-heavy sites.

The NodeJS-native architecture eliminates the overhead of API calls and cross-language communication, resulting in dramatically faster processing times.
</details>

## Key Features

<details>
<summary><strong>⚡ Core Capabilities</strong></summary>

- **Lightning-fast HTML to Markdown** - Optimized for speed and accuracy
- **Precise content targeting** - Extract only what you need with CSS selectors
- **Header & footer removal** - Clean content out of the box
- **Anti-detection mechanisms** - Avoid being blocked
- **Dynamic content handling** - 3-stage approach ensures content extraction
- **Webhook integration** - Configure your own webhook templates
- **Metadata extraction** - Title, description, author, etc.
- **Automatic retry mechanism** - Always gets the job done
</details>

<details>
<summary><strong>🧠 AI Integration Features</strong></summary>

- **Clean, structured content** - Perfect for AI training
- **Context preservation** - Better embeddings for RAG systems
- **Configurable chunking preparation** - Control the granularity
- **Rich metadata extraction** - Enhance your ML pipelines
- **LLM-ready output format** - No additional processing needed
</details>

<details>
<summary><strong>🛡️ Bulletproof Content Extraction</strong></summary>

SpiderForce4AI uses a sophisticated 3-stage approach to extract content:

1. **STAGE 0 (Default)**: Fast extraction with aggressive cleaning - optimized for speed
2. **STAGE 1 (First Fallback)**: When content is insufficient, re-run with scroll to bottom, wait 200ms, retry extraction
3. **STAGE 2 (Last Resort)**: If still insufficient, re-run with disabled aggressive cleaning

This approach maintains speed for 98% of sites while providing bulletproof extraction for problematic pages. The system automatically adapts based on content quality.
</details>

<details>
<summary><strong>🔄 Batch Processing</strong></summary>

- **Sitemap crawling and parsing** - Process entire websites
- **Bulk URL processing** - Handle lists of URLs efficiently
- **Progress tracking and reporting** - Monitor your jobs
- **Parallel processing** - Maximize throughput
- **Real-time webhook updates** - Get notified as pages are processed
</details>

## Quick Start Guide

<details>
<summary><strong>Installation Options</strong></summary>

### Docker (Recommended)
```bash
docker run -d --restart unless-stopped -p 3004:3004 --name spiderforce4ai petertamai/spiderforce4ai:latest
```

### From GitHub
```bash
# Clone repository
git clone https://github.com/petertamai/spiderforce4ai.git

# Enter directory
cd spiderforce4ai

# Install dependencies
npm install

# Create logs directory
mkdir logs

# Copy environment file
cp .env.example .env

# Install PM2 globally if not installed
npm install -g pm2

# Start with PM2
npm run start:pm2
```
</details>

<details>
<summary><strong>Basic API Usage</strong></summary>

### Convert a URL to Markdown
```bash
curl "http://localhost:3004/convert?url=https://example.com"
```

### Advanced Content Targeting
```bash
curl -X POST "http://localhost:3004/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "targetSelectors": [".main-content", "article", "#content"],
    "removeSelectors": [".ads", ".sidebar", ".nav"]
  }'
```

### Configure Dynamic Content Handling
```bash
curl -X POST "http://localhost:3004/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "min_content_length": 1000,
    "scroll_wait_time": 300,
    "aggressive_cleaning": true
  }'
```
</details>

<details>
<summary><strong>Batch Processing</strong></summary>

### Crawl a Sitemap
```bash
curl -X POST "http://localhost:3004/crawl_sitemap" \
  -H "Content-Type: application/json" \
  -d '{
    "sitemapUrl": "https://example.com/sitemap.xml",
    "targetSelectors": [".main-content", "article"],
    "removeSelectors": [".ads", ".nav"],
    "webhook": {
      "url": "https://your-webhook.com/endpoint",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }'
```

### Process Multiple URLs
```bash
curl -X POST "http://localhost:3004/crawl_urls" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/page1",
      "https://example.com/page2"
    ],
    "targetSelectors": [".main-content", "article"]
  }'
```

### Check Job Status
```bash
curl "http://localhost:3004/job/job_1234567890"
```
</details>

<details>
<summary><strong>Integration Examples</strong></summary>

### RAG System Integration
```bash
curl -X POST "http://localhost:3004/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "targetSelectors": [".article-content"],
    "custom_webhook": {
      "url": "https://your-vectordb-api.com/ingest",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer your-token"
      },
      "data": {
        "content": "##markdown##",
        "metadata": {
          "url": "##url##",
          "timestamp": "##timestamp##",
          "title": "##metadata##"
        }
      }
    }
  }'
```

### n8n Integration
```javascript
// SpiderForce4AI Tool for n8n
const SPIDERFORCE_BASE_URL = 'http://localhost:3004';

try {
    if (!query || !query.startsWith('http')) {
        return 'Error: Invalid URL provided';
    }

    const options = {
        url: `${SPIDERFORCE_BASE_URL}/convert`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
            url: query,
            targetSelectors: ['.main-content', 'article', '#content']
        }
    };

    const response = await this.helpers.httpRequest(options);
    return response.markdown || response.toString();
} catch (error) {
    return `Error processing URL: ${error.message}`;
}
```

### DIFY Integration
```yaml
openapi: 3.0.0
info:
  title: SpiderForce4AI Web to Markdown Converter
  description: Convert a web page to Markdown using Dify
  author: Piotr Tamulewicz
  version: 1.0.0

servers:
  - url: http://localhost:3004

paths:
  /convert:
    get:
      summary: Convert a web page to Markdown
      parameters:
        - name: url
          in: query
          description: The URL of the web page to convert
          required: true
          schema:
            type: string
            format: uri
      responses:
        '200':
          description: Successful conversion
          content:
            text/markdown:
              schema:
                type: string
```
</details>

<details>
<summary><strong>Firecrawl API Compatibility</strong></summary>

SpiderForce4AI provides full compatibility with Firecrawl's API endpoints, allowing for easy migration:

### Single URL Scraping
```bash
curl -X POST http://localhost:3004/v1/scrape \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"]
  }'
```

### Crawl Website
```bash
curl -X POST http://localhost:3004/v1/crawl \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{
    "url": "https://example.com/sitemap.xml",
    "limit": 100,
    "webhook": "https://your-webhook.com/endpoint"
  }'
```
</details>

## Configuration

<details>
<summary><strong>Environment Variables</strong></summary>

```env
PORT=3004
NODE_ENV=production
MAX_RETRIES=2
PAGE_TIMEOUT=30000
MAX_CONCURRENT_PAGES=10

# Cleaning Configuration
AGGRESSIVE_CLEANING=true
REMOVE_IMAGES=false

# Dynamic Content Handling
MIN_CONTENT_LENGTH=500
SCROLL_WAIT_TIME=200
```
</details>

<details>
<summary><strong>PM2 Management</strong></summary>

```bash
# Start service
npm run start:pm2

# View logs
npm run logs:pm2

# Restart service
npm run restart:pm2

# Stop service
npm run stop:pm2
```
</details>

## Why Choose SpiderForce4AI?

<details>
<summary><strong>vs. Firecrawl</strong></summary>

- **343% faster processing** (1.69s vs 5.83s average)
- **No subscription costs** - run on your own infrastructure
- **More reliable content extraction** with 3-stage fallback
- **Better targeting options** for complex pages
- **No rate limits or credits** to manage
- **Full API compatibility** for easy migration
</details>

<details>
<summary><strong>vs. Jina AI</strong></summary>

- **206% faster processing** (1.69s vs 3.49s average)
- **No cloud dependency** - works offline
- **NodeJS-native** (not Python wrapped in API calls)
- **Lower latency** for real-time applications
- **Fine-grained control** over extraction process
- **Direct RAG integration** options
</details>

<details>
<summary><strong>vs. Python-based Scrapers</strong></summary>

- **NodeJS-native architecture** eliminates cross-language overhead
- **Built on Puppeteer** for superior JavaScript handling
- **Better performance** for dynamic content
- **Lightweight memory footprint** - run on smaller servers
- **Faster cold start times**
</details>

## Python Wrapper

Need more control? Use our Python wrapper for SpiderForce4AI:
- Parallel crawling capabilities
- LLM integration and data extraction
- AI post-processing pipeline
- Advanced webhook management

[![PyPI version](https://badge.fury.io/py/spiderforce4ai.svg)](https://badge.fury.io/py/spiderforce4ai)
[https://pypi.org/project/spiderforce4ai/](https://pypi.org/project/spiderforce4ai/)

## Who Created This?

I'm [Piotr Tamulewicz](https://petertam.pro), and I've been building web scrapers professionally since 2010. 

SpiderForce4AI is my contribution to the AI community - after years of seeing companies charge exorbitant prices for crawling capabilities, I wanted to provide a high-performance, open-source alternative that anyone can use.

**My goal:** Make high-quality web content extraction accessible to everyone building AI systems, regardless of budget.

This project is part of my broader vision to contribute to modern AI development with practical, performance-focused tools based on real-world experience.

## License

MIT License

## Star ⭐ If You Like It!

If SpiderForce4AI has helped your project, please consider giving it a star on GitHub. It helps others discover this tool and motivates continued development.

---

*Keywords: web scraping, content extraction, html to markdown, firecrawl alternative, jina ai alternative, web crawler, content processor, html parser, markdown converter, web content extractor, RAG system, AI training data, retrieval augmented generation, SEO analysis, LLM data preparation, machine learning pipeline, clean text extraction, sitemap crawler, batch processing, webhook integration, parallel processing, content harvesting, data collection, automated workflows*