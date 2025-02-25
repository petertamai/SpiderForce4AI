# Dockerfile
FROM node:20-slim
LABEL maintainer="Piotr Tamulewicz <pt@petertam.pro>"
LABEL description="SpiderForce4AI - Advanced web scraping and automation tool with stealth capabilities"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://petertam.pro"
LABEL org.opencontainers.image.documentation="https://github.com/petertamai/spiderforce4ai"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="PeterTam.pro"
LABEL org.opencontainers.image.title="SpiderForce4AI"



# Add non-root user for security
RUN groupadd -r spiderforce && useradd -r -g spiderforce -G audio,video spiderforce \
    && mkdir -p /home/spiderforce/Downloads \
    && chown -R spiderforce:spiderforce /home/spiderforce

# Install required dependencies for Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && mkdir -p /etc/apt/sources.list.d \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y \
    google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libxtst6 \
    libgbm1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Update npm to latest version and install PM2
RUN npm install -g npm@latest pm2@latest

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
##copy home.md


# Install dependencies with specific versions for better reproducibility
RUN npm install puppeteer-extra@3.3.6 \
    puppeteer-extra-plugin-stealth@2.11.2 \
    puppeteer-extra-plugin-adblocker@2.13.6 \
    && npm install

# Create necessary directories with proper permissions
RUN mkdir -p logs src/utils src/config src/rules \
    && chown -R spiderforce:spiderforce /usr/src/app

# Copy source files
COPY --chown=spiderforce:spiderforce src/ src/
COPY --chown=spiderforce:spiderforce ecosystem.config.js ./
COPY --chown=spiderforce:spiderforce .env.example .env
#COPY --chown=spiderforce:spiderforce home.md home.md

# Set environment variables
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    CHROME_PATH=/usr/bin/google-chrome-stable \
    HOME=/home/spiderforce

# Switch to non-root user
USER spiderforce

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3004/health', (r) => {if (r.statusCode !== 200) throw Error()})"

# Expose the port
EXPOSE 3004

# Start PM2 runtime with proper logging
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]