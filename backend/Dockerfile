# SagaOS Backend API Gateway
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sagaos -u 1001

# Change ownership of the app directory
RUN chown -R sagaos:nodejs /app
USER sagaos

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV KEA_CA_URL=http://kea-ca:8000
ENV DB_HOST=postgres
ENV DB_PORT=5432
ENV DB_NAME=sagaos
ENV DB_USER=sagaos
ENV DB_PASSWORD=changeme

# Start the application
CMD ["node", "api-gateway.js"]
