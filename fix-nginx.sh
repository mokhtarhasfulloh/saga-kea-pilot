#!/bin/bash

# ============================================================================
# SagaOS - Quick Fix for Nginx Default Page Issue
# ============================================================================
# This script fixes the issue where Nginx shows the default page
# instead of the SagaOS application
# ============================================================================

set -e

echo "🔧 SagaOS Nginx Configuration Fix"
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Check if SagaOS is installed
if [ ! -d "/opt/sagaos" ]; then
    echo "❌ SagaOS installation not found at /opt/sagaos"
    exit 1
fi

echo "✅ SagaOS installation found"
echo ""

# Check if frontend is built
if [ ! -d "/opt/sagaos/dist" ] || [ ! -f "/opt/sagaos/dist/index.html" ]; then
    echo "⚠️  Frontend dist folder not found or incomplete"
    echo "📦 Building frontend..."
    
    cd /opt/sagaos
    
    # Check if we need to install dependencies
    if [ ! -d "node_modules" ]; then
        echo "📥 Installing Node.js dependencies..."
        sudo -u sagaos npm install
    fi
    
    # Build frontend
    echo "🔨 Building frontend application..."
    sudo -u sagaos npm run build
    
    if [ -f "/opt/sagaos/dist/index.html" ]; then
        echo "✅ Frontend built successfully"
    else
        echo "❌ Frontend build failed"
        exit 1
    fi
else
    echo "✅ Frontend dist folder exists"
fi

echo ""
echo "🔧 Configuring Nginx..."

# Remove default site
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "🗑️  Removing default Nginx site..."
    rm -f /etc/nginx/sites-enabled/default
fi

# Check if SagaOS site is enabled
if [ ! -L "/etc/nginx/sites-enabled/sagaos" ]; then
    echo "🔗 Enabling SagaOS site..."
    ln -sf /etc/nginx/sites-available/sagaos /etc/nginx/sites-enabled/sagaos
fi

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

echo ""
echo "🔄 Restarting Nginx..."
systemctl restart nginx

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx restarted successfully"
else
    echo "❌ Nginx failed to start"
    systemctl status nginx --no-pager
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Nginx Configuration Fixed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Your SagaOS application should now be accessible at:"
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "   http://$SERVER_IP"
echo ""
echo "   Login: admin / admin"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 If you still see the default Nginx page:"
echo "   1. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)"
echo "   2. Try accessing from a different browser or incognito mode"
echo ""

