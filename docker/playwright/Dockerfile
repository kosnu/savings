# Use Node.js v24
FROM node:24.6.0-bullseye-slim

# Set the working directory
WORKDIR /playwright

# Copy Playwright-specific package.json to the container
COPY package.json package-lock.json ./

# Install Playwright dependencies
RUN npm ci
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  ca-certificates \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

RUN npx playwright install chromium

# コンテナにシェルで入る
CMD [ "/bin/bash" ]
