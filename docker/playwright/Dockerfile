# Use Node.js v24
FROM node:24.6.0-bullseye-slim

# Set the working directory
WORKDIR /playwright

RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Copy Playwright-specific package.json to the container
COPY package.json package-lock.json ./

# Install Playwright dependencies
RUN npm ci
RUN npx playwright install --with-deps chromium

# コンテナにシェルで入る
CMD [ "/bin/bash" ]
