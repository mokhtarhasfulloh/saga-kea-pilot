# Multi-stage build for SagaOS Frontend
# Stage 1: Build the React application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx configuration template
COPY config/nginx/nginx.conf /etc/nginx/templates/default.conf.template

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy environment substitution script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create environment template for runtime configuration
RUN echo 'window.ENV = {' > /usr/share/nginx/html/env.js.template && \
    echo '  API_BASE_URL: "${API_BASE_URL}",' >> /usr/share/nginx/html/env.js.template && \
    echo '  WS_URL: "${WS_URL}",' >> /usr/share/nginx/html/env.js.template && \
    echo '  APP_VERSION: "${APP_VERSION}",' >> /usr/share/nginx/html/env.js.template && \
    echo '  ENVIRONMENT: "${ENVIRONMENT}"' >> /usr/share/nginx/html/env.js.template && \
    echo '};' >> /usr/share/nginx/html/env.js.template

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Set default environment variables
ENV API_BASE_URL=http://localhost:3001/api
ENV WS_URL=ws://localhost:3001/ws
ENV APP_VERSION=1.0.0
ENV ENVIRONMENT=production

# Use custom entrypoint for environment variable substitution
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
