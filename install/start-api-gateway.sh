#!/bin/bash

# SagaOS API Gateway Startup Script
# This script starts the API gateway with proper environment configuration

set -e

echo "🚀 Starting SagaOS API Gateway..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "💡 Please install Node.js first:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install express cors http-proxy-middleware ws
fi

# Set environment variables
export PORT=3001
export KEA_CA_URL=http://127.0.0.1:8000
export DNS_SERVER=127.0.0.1
export DNS_PORT=53
export DNS_TSIG_KEY_NAME=sagaos-ddns-key
export DNS_TSIG_KEY_FILE=/etc/bind/keys/sagaos-ddns-key.key
export DNS_ZONE_DIR=/var/lib/bind
export DNS_NAMED_CONF_LOCAL=/etc/bind/named.conf.local

echo "🔧 Environment configured:"
echo "   PORT: $PORT"
echo "   KEA_CA_URL: $KEA_CA_URL"
echo "   DNS_SERVER: $DNS_SERVER"

# Check if BIND9 configuration files exist
if [ -f "$DNS_NAMED_CONF_LOCAL" ] && [ -f "$DNS_TSIG_KEY_FILE" ]; then
    echo "✅ BIND9 configuration found"
else
    echo "⚠️  BIND9 not fully configured (will use mock data)"
    echo "   Missing files:"
    [ ! -f "$DNS_NAMED_CONF_LOCAL" ] && echo "   - $DNS_NAMED_CONF_LOCAL"
    [ ! -f "$DNS_TSIG_KEY_FILE" ] && echo "   - $DNS_TSIG_KEY_FILE"
fi

# Start the API gateway
echo "🌐 Starting API Gateway on port $PORT..."
echo "📡 Health check: http://localhost:$PORT/api/health"
echo "🔍 DNS status: http://localhost:$PORT/api/dns/status"
echo ""
echo "Press Ctrl+C to stop"

node backend/api-gateway.js
