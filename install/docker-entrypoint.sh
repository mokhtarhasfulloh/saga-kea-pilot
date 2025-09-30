#!/bin/sh
set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting SagaOS Frontend container..."

# Substitute environment variables in nginx config
log "Configuring nginx with environment variables..."
envsubst '${API_BASE_URL} ${WS_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Generate runtime environment configuration
log "Generating runtime environment configuration..."
envsubst '${API_BASE_URL} ${WS_URL} ${APP_VERSION} ${ENVIRONMENT}' < /usr/share/nginx/html/env.js.template > /usr/share/nginx/html/env.js

# Update index.html to include the environment configuration
if [ -f /usr/share/nginx/html/index.html ]; then
    log "Injecting environment configuration into index.html..."
    # Add the env.js script before the closing head tag
    sed -i 's|</head>|  <script src="/env.js"></script>\n</head>|' /usr/share/nginx/html/index.html
fi

# Validate nginx configuration
log "Validating nginx configuration..."
nginx -t

log "Configuration complete. Starting nginx..."

# Execute the main command
exec "$@"
