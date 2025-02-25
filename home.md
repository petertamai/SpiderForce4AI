# SpiderForce4AI Simple (Jina, Firecrawl Alternative)

🚀 High-performance HTML to Markdown converter and content extractor, optimized for AI training data collection, RAG (Retrieval-Augmented Generation), and SEO analysis. A powerful alternative to Firecrawl and Jina AI, designed for speed and precision in web content processing.

## API Usage

### Basic Conversion
```bash
curl "http://localhost:{port}/convert?url=https://example.com"
```

### Advanced Content Targeting
```bash
curl -X POST "http://localhost:{port}/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "targetSelectors": [".main-content", "article", "#content"],
    "removeSelectors": [".ads", ".sidebar", ".nav"]
  }'
```

### AI Training Data Collection
```bash
curl -X POST "http://localhost:{port}/convert" \
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
curl -X POST "http://localhost:{port}/crawl_sitemap" \
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

Webhooks can be customized with variables, headers, url, and extra fields, so that you can integrate with your systems, like LLMs, data collection, vector databases, or any other tool you need.

### Batch URL Processing
```bash
curl -X POST "http://localhost:{port}/crawl_urls" \
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
curl "http://localhost:{port}/job/job_1234567890"
```

### RAG System Integration
```bash
curl -X POST "http://localhost:{port}/convert" \
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

### Webhook with Progress Updates (beta)
```bash
curl -X POST "http://localhost:{port}/crawl_urls" \
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

## Author

Created and maintained by [Piotr Tamulewicz](https://petertam.pro)
