# SpiderForce4AI (FireCrawl, Jina AI, Crawl4AI Alternative)

> Run your own web crawler without annoying limits or insane costs. Just $10/month on any basic VPS (1GB RAM, 1 core is enough; 2GB, 2 cores is comfortable).

A high-performance HTML to Markdown converter built for AI training data, RAG systems, and anyone sick of overpriced web crawling services. 

**This crawler is highly optimized for speed and performance—it does what it takes and cuts out unnecessary bs.**

**No menus, no footers, no cookie consents out of the box!**

![Crawling Time Comparison](https://petertam.pro/wp-content/uploads/2025/02/comparison.png)

Yeah, that's right - consistently faster than both Firecrawl and Jina AI across 30 test sites. These were randomly selected sites, accross diffrent world regions.

![Average Processing Time](https://petertam.pro/wp-content/uploads/2025/02/avgtime.png)

**Average processing times:**
- SpiderForce4AI: 1.69s
- Jina AI: 3.49s 
- Firecrawl: 5.83s

## Super quick start with docker
```bash
docker run -d --restart unless-stopped -p 3004:3004 --name spiderforce2ai petertamai/spiderforce2ai:latest
```
Run already compiled version from docker hub. No configuration needed.

```plaintext
http://localhost:3004/convert?url=https://petertam.pro
```

## One-Click Deployment

### Digital Ocean
[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/petertamai/SpiderForce4AI/tree/main)

## Features

<details>
<summary><strong>⚡ Core Capabilities</strong></summary>

- ⚡ Lightning-fast HTML to Markdown conversion
- 🎯 Precise content targeting with multiple selectors
- 🧹 No menus, no footers out of the box!
- 🤖 Built-in anti-detection mechanisms
- 🎣 Custom webhook integration - configure your own webhooks template
- 📊 Metadata extraction
- 🔄 Automatic retry mechanism
- 🛡️ Bullet-proof dynamic content handling
</details>

<details>
<summary><strong>🧠 AI & RAG Features</strong></summary>

- 📚 Clean, structured content for AI training
- 🧮 Context preservation for better embeddings
- 📑 Automated content chunking preparation
- 🔍 Rich metadata extraction for ML pipelines
- 📈 Batch processing capabilities
- 🤖 LLM-ready output format
</details>

<details>
<summary><strong>🔧 Advanced Features</strong></summary>

- 🛡️ Stealth mode with Puppeteer
- 🚫 Built-in ad and tracker blocking
- 🍪 Automatic cookie consent handling
- 🧬 Dynamic content processing
- 🎭 Browser fingerprint protection
- 📝 Markdown optimization
- 🔌 Webhook customization with variables
- 🌐 Multi-stage fallback for problematic sites
- 🚀 Smart content length detection
</details>

<details>
<summary><strong>📦 Batch Processing Features</strong></summary>

- 🌐 Sitemap crawling and parsing
- 📦 Bulk URL processing
- 📊 Progress tracking and reporting
- 🔄 Parallel processing
- 📡 Real-time webhook updates
- 📝 Job status monitoring
- 🎯 Customizable batch sizes
- 🚦 Rate limiting and queuing
</details>

## Performance Highlights

I built this with performance in mind. It works like a tank - reliable and unstoppable - but with the speed of a sports car:

- Maintains single browser instance for optimal performance
- Smart resource blocking for faster processing
- Concurrent request handling
- Memory-optimized processing
- Automatic cleanup and resource management
- Parallel batch processing
- Job queuing and monitoring
- Resource usage optimization
- Intelligent dynamic content handling with 3-stage fallback

## Dynamic Content Handling

Websites are annoying. Sometimes they load content dynamically, and sometimes they try to hide their real content. SpiderForce4AI has a 3-stage approach to handle these challenges:

<details>
<summary><strong>🚀 Dynamic Content Extraction Strategy</strong></summary>

1. **STAGE 0 (Default)**: Fast extraction with aggressive cleaning - optimized for speed
2. **STAGE 1 (First Fallback)**: If content is insufficient, re-run with scroll to the bottom, wait 200ms, then try extraction with aggressive cleaning
3. **STAGE 2 (Last Resort)**: If content is still insufficient, re-run with scroll to the bottom, wait 200ms, and disable aggressive cleaning

This approach maintains speed for the vast majority of sites while providing bulletproof extraction for problematic pages. The system automatically adapts based on content quality.
</details>

<details>
<summary><strong>⚙️ Configuration Options</strong></summary>

```env
# Dynamic Content Configuration
MIN_CONTENT_LENGTH=500           # Minimum acceptable content length (characters)
SCROLL_WAIT_TIME=200             # Milliseconds to wait after scrolling
AGGRESSIVE_CLEANING=true         # Enable/disable aggressive cleaning by default
```

These settings can be adjusted to optimize for your specific use cases:
- Reduce `MIN_CONTENT_LENGTH` to prioritize speed
- Increase it to ensure more thorough content extraction
- Set it to 0 to completely disable dynamic content handling
</details>

## Why I Built This - My Personal Journey

Web scraping and content extraction are deceptively complex. Since 2010, I've been building tools to tackle these challenges, and each year brings new obstacles: JavaScript frameworks, anti-bot systems, complex DOM structures, and ever-changing web standards.

Web crawling doesn't have to be expensive or complicated. While solutions like Jina.ai and Firecrawl offer great features, they often come with hefty price tags or limitations. This project gives you a free, ready-to-use crawler backed by years of real-world scraping experience - no strings attached.

Why NodeJS? Simple - when you're scraping with Puppeteer, adding a Python wrapper just adds overhead. This is built to be fast from the ground up, without any unnecessary communication between languages or services.

## Python Wrapper
Need more control over the crawling process? Check out my Python wrapper for SpiderForce4AI.
- Parrallel crawling 
- LLM integration and data extraction
- AI post-processing - crawl and extract data to any format you need with a support of LLMs
- Webhook integration

[![PyPI version](https://badge.fury.io/py/spiderforce4ai.svg)](https://badge.fury.io/py/spiderforce4ai)
[https://pypi.org/project/spiderforce4ai/](https://pypi.org/project/spiderforce4ai/)

## Installation from github

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

## API Usage

### Basic Conversion
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

### Dynamic Content Configuration
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

### AI Data Collection
```bash
curl -X POST "http://localhost:3004/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "targetSelectors": [
      "article",
      ".main-content",
      ".blog-post"
    ],
    "removeSelectors": [
      ".ads",
      ".comments",
      ".related-posts"
    ]
  }'
```

### Sitemap Crawling
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
      },
      "progressUpdates": true,
      "extraFields": {
        "project": "blog-crawler",
        "source": "sitemap"
      }
    }
  }'
```

### Batch URL Processing
```bash
curl -X POST "http://localhost:3004/crawl_urls" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/page1",
      "https://example.com/page2",
      "https://example.com/page3"
    ],
    "targetSelectors": [".main-content", "article"],
    "removeSelectors": [".ads", ".nav"],
    "webhook": {
      "url": "https://your-webhook.com/endpoint",
      "headers": {
        "Authorization": "Bearer your-token"
      },
      "progressUpdates": true,
      "extraFields": {
        "batchId": "custom-batch-1",
        "priority": "high"
      }
    }
  }'
```

### Job Status Checking
```bash
curl "http://localhost:3004/job/job_1234567890"
```

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

### Webhook with Progress Updates
```bash
curl -X POST "http://localhost:3004/crawl_urls" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com/page1"],
    "targetSelectors": [".content"],
    "webhook": {
      "url": "https://your-api.com/webhook",
      "headers": {
        "Authorization": "Bearer token",
        "X-Custom-Header": "value"
      },
      "progressUpdates": true,
      "extraFields": {
        "project": "my-crawler",
        "source": "custom"
      }
    }
  }'
```

## Configuration

### Environment Variables
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

### PM2 Management
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

## Firecrawl API Compatibility (beta)

SpiderForce4AI provides full compatibility with Firecrawl's API endpoints, allowing for easy migration from Firecrawl to SpiderForce4AI.

<details>
<summary><strong>Firecrawl-compatible API Examples</strong></summary>

#### Single URL Scraping
```bash
curl -X POST http://localhost:3004/v1/scrape \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \  # Any API key
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"]
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "markdown": "# Markdown Content",
    "metadata": {
      "title": "Page Title",
      "description": "Page description",
      "language": "en",
      "sourceURL": "https://example.com"
    }
  }
}
```

#### Crawl Website
```bash
curl -X POST http://localhost:3004/v1/crawl \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{
    "url": "https://example.com/sitemap.xml",
    "limit": 100,
    "webhook": "https://your-webhook.com/endpoint",
    "scrapeOptions": {
      "formats": ["markdown"]
    }
  }'
```

Response:
```json
{
  "success": true,
  "id": "job_1234567890",
  "url": "/v1/crawl/job_1234567890"
}
```

#### Check Crawl Status
```bash
curl -X GET http://localhost:3004/v1/crawl/job_1234567890 \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

Response:
```json
{
  "status": "completed",
  "total": 36,
  "completed": 36,
  "creditsUsed": 36,
  "expiresAt": "2024-02-23T12:00:00.000Z",
  "next": null,
  "data": [
    {
      "markdown": "# Page Title\n\nContent...",
      "metadata": {
        "title": "Page Title",
        "description": "Page description",
        "language": "en",
        "sourceURL": "https://example.com/page1",
        "statusCode": 200
      }
    }
  ]
}
```

#### Webhook Events
When using webhooks, you'll receive events in Firecrawl format:

```json
{
  "status": "completed",
  "totalCount": 36,
  "creditsUsed": 36,
  "expiresAt": "2024-02-23T12:00:00.000Z",
  "data": [
    {
      "markdown": "# Page Content",
      "metadata": {
        "title": "Page Title",
        "description": "Page Description",
        "language": "en",
        "sourceURL": "https://example.com/page",
        "statusCode": 200
      }
    }
  ]
}
```
</details>

#####  Key differences from Firecrawl:
- No rate limiting or credit system
- Faster processing with local deployment
- Additional content cleaning options
- Enhanced metadata extraction
- No cloud dependency
- Bulletproof dynamic content handling


## Use with N8N Code Tool

```javascript
// SpiderForce4AI Tool
// This tool processes URLs through SpiderForce4AI and returns markdown content.
// The input comes as 'query' parameter containing a URL

const SPIDERFORCE_BASE_URL = 'http://localhost:3004'; // or your cloud deployment instance URL

try {
    // Validate input
    if (!query || !query.startsWith('http')) {
        return 'Error: Invalid URL provided. URL must start with http:// or https://';
    }

    const options = {
        url: `${SPIDERFORCE_BASE_URL}/convert`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            url: query,
            targetSelectors: ['.main-content', 'article', '#content'],
            removeSelectors: ['.ads', '.nav', '.footer', '.header']
        }
    };

    const response = await this.helpers.httpRequest(options);
    
    // Return markdown content from response
    return response.markdown || response.toString();

} catch (error) {
    return `Error processing URL: ${error.message}`;
}
```

## Use with DIFY (or any Open AI - YAML format)

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
      description: Retrieves the content of a web page and converts it to Markdown format
      parameters:
        - name: url
          in: query
          description: The URL of the web page to convert
          required: true
          schema:
            type: string
            format: uri
        - name: targetSelectors
          in: query
          description: CSS selectors to target specific content (comma-separated)
          required: false
          schema:
            type: string
        - name: removeSelectors
          in: query  
          description: CSS selectors to remove unwanted content (comma-separated)
          required: false
          schema:
            type: string
      responses:
        '200':
          description: Successful conversion
          content:
            text/markdown:
              schema:
                type: string
        '400':
          description: Bad request (missing or invalid URL)
        '500':
          description: Internal server error
```

## Why SpiderForce4AI as Firecrawl, Jina AI, or Crawl4AI Alternative?

<details>
<summary><strong>Advantages over Firecrawl</strong></summary>

- Lighter resource footprint
- Faster processing speed
- Built-in content cleaning
- More flexible content targeting
- Custom webhook integration
- Optimized for AI/ML pipelines
- RAG system integration
- Batch processing support
- Sitemap crawling
- Progress tracking
- Multi-stage dynamic content handling
- No subscription costs
</details>

<details>
<summary><strong>Advantages over Jina AI</strong></summary>

- No cloud dependency
- Full control over processing
- Custom cleaning rules
- Webhook integration
- Lower latency
- Direct RAG integration
- Customizable content structure
- Parallel processing
- Real-time updates
- Local deployment
- Bulletproof content extraction
</details>

## Use Cases

<details>
<summary><strong>AI and Machine Learning</strong></summary>

- Training data collection
- RAG system content ingestion
- NLP dataset creation
- Content classification
- Sentiment analysis data
- Knowledge base building
- Information retrieval systems
</details>

<details>
<summary><strong>Content Processing</strong></summary>

- News article extraction
- Blog content processing
- Documentation conversion
- Web content archiving
- SEO content analysis
- Research data collection
- Content aggregation
</details>

<details>
<summary><strong>Batch Processing</strong></summary>

- Site-wide content extraction
- Content migration
- Data archiving
- Competitive analysis
- Content auditing
- Mass data collection
- Documentation harvesting
</details>

<details>
<summary><strong>Automated Workflows</strong></summary>

- Content syndication
- Knowledge base updates
- Dataset generation
- Content monitoring
- Scheduled crawling
- Bulk processing
- Archive creation
</details>

## Technical Details

<details>
<summary><strong>Content Processing</strong></summary>

- Intelligent header/footer removal
- Cookie consent popup handling
- Dynamic content extraction
- Ad and tracker blocking
- Resource optimization
- Content structure preservation
- Clean text chunking
- Parallel processing
- Job monitoring
- Progress tracking
- Multi-stage content extraction fallbacks
</details>

<details>
<summary><strong>Security Features</strong></summary>

- Browser fingerprint protection
- Request rate limiting
- Resource usage limits
- Error handling and recovery
- Safe shutdown procedures
- Anti-bot detection measures
- Connection security
- Resource cleanup
</details>

<details>
<summary><strong>Performance Features</strong></summary>

- Concurrent processing
- Resource pooling
- Memory management
- Connection reuse
- Smart retries
- Batch optimization
- Queue management
- Progress monitoring
- Adaptive content extraction
</details>

## Content Quality Features

<details>
<summary><strong>Clean Data Extraction</strong></summary>

- Smart boilerplate removal
- Navigation elimination
- Ad content filtering
- Comment section removal
- Dynamic content handling
- Structure preservation
- Context maintenance
- Adaptive cleaning strategies
</details>

<details>
<summary><strong>Structure Preservation</strong></summary>

- Header hierarchy maintenance
- List formatting
- Table structure
- Code block handling
- Quote preservation
- Semantic relationships
- Link management
- Image processing
</details>

<details>
<summary><strong>Metadata Enrichment</strong></summary>

- Title and description
- Author information
- Publication dates
- Categories and tags
- SEO elements
- Source tracking
- Processing metadata
- Job tracking data
</details>

<details>
<summary><strong>Batch Processing Features</strong></summary>

- Progress tracking
- Status reporting
- Error handling
- Retry mechanisms
- Resource management
- Queue handling
- Webhook notifications
- Job monitoring
</details>

## Support and Contributing

<details>
<summary><strong>Support</strong></summary>

- Create an issue for bugs
- Join discussions for feature requests
- Check documentation for usage questions
- Technical support
- Feature suggestions
- Bug reporting
</details>

<details>
<summary><strong>Contributing</strong></summary>

- Fork the repository
- Create feature branch
- Submit pull request
- Follow coding standards
- Write documentation
- Add test cases
- Code review
- Quality assurance
</details>

## License

MIT License

## Author

Created and maintained by [Piotr Tamulewicz](https://petertam.pro)

This is just one of several projects I'm releasing to help improve the AI development ecosystem. If you find this useful, consider giving it a star or reaching out to collaborate on future projects.

---

Keywords: web scraping, content extraction, html to markdown, firecrawl alternative, jina ai alternative, web crawler, content processor, html parser, markdown converter, web content extractor, RAG system, AI training data, retrieval augmented generation, SEO analysis, LLM data preparation, machine learning pipeline, clean text extraction, sitemap crawler, batch processing, webhook integration, parallel processing, content harvesting, data collection, automated workflows