FROM node:20-alpine

# Security: Set working directory and configure ownership
# We create the directory and set ownership to the built-in non-root 'node' user (UID 1000).
RUN mkdir -p /app && chown -R node:node /app

WORKDIR /app

# Switch to the non-root user for all subsequent operations
USER node

# Copy package files first to leverage Docker layer caching
COPY --chown=node:node package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
# Note: When run via docker-compose, this directory will be overshadowed by the local volume mount
COPY --chown=node:node . .

EXPOSE 3000

# We use the development server for hot-reloading code changes without rebuilding
CMD ["npm", "run", "dev"]
