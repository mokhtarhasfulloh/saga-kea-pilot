#!/bin/bash

# ============================================================================
# SagaOS - Quick Fix for Kea Control Agent HTTP 405 Errors
# ============================================================================
# This script fixes the issue where the frontend gets HTTP 405 errors
# when trying to access the Kea Control Agent
# ============================================================================

set -e

echo "🔧 SagaOS Kea Control Agent Proxy Fix"
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

echo "🔍 Checking Nginx configuration..."

# Check if the wrong proxy path exists
if grep -q "location /kea/" /etc/nginx/sites-available/sagaos 2>/dev/null; then
    echo "⚠️  Found incorrect proxy path: /kea/"
    echo "🔧 Fixing proxy path to /ca/..."
    
    # Replace /kea/ with /ca/ in the Nginx config
    sed -i 's|location /kea/|location /ca/|g' /etc/nginx/sites-available/sagaos
    
    echo "✅ Proxy path updated"
elif grep -q "location /ca/" /etc/nginx/sites-available/sagaos 2>/dev/null; then
    echo "✅ Correct proxy path already configured: /ca/"
else
    echo "⚠️  No Kea/CA proxy found in Nginx config"
    echo "📝 Adding /ca/ proxy configuration..."
    
    # Add the /ca/ proxy before the security headers section
    sed -i '/# Security headers/i \    # Kea Control Agent proxy (for direct CA access)\n    location /ca/ {\n        proxy_pass http://localhost:8000/;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n' /etc/nginx/sites-available/sagaos
    
    echo "✅ Proxy configuration added"
fi

echo ""
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
echo "🔍 Checking Kea Control Agent status..."
if systemctl is-active --quiet isc-kea-ctrl-agent 2>/dev/null; then
    echo "✅ Kea Control Agent is running (isc-kea-ctrl-agent)"
elif systemctl is-active --quiet kea-ctrl-agent 2>/dev/null; then
    echo "✅ Kea Control Agent is running (kea-ctrl-agent)"
else
    echo "⚠️  Kea Control Agent is not running"
    echo "🔄 Attempting to start Kea Control Agent..."
    
    if systemctl start isc-kea-ctrl-agent 2>/dev/null; then
        echo "✅ Kea Control Agent started (isc-kea-ctrl-agent)"
    elif systemctl start kea-ctrl-agent 2>/dev/null; then
        echo "✅ Kea Control Agent started (kea-ctrl-agent)"
    else
        echo "❌ Failed to start Kea Control Agent"
        echo "   Please check the service manually"
    fi
fi

echo ""
echo "🧪 Testing Kea Control Agent connectivity..."
if curl -s -u admin:admin -X POST http://localhost:8000/ \
    -H "Content-Type: application/json" \
    -d '{"command":"version-get","service":["dhcp4"]}' | grep -q "result"; then
    echo "✅ Kea Control Agent is responding correctly"
else
    echo "⚠️  Kea Control Agent may not be responding"
    echo "   Check /var/log/kea/kea-ctrl-agent.log for errors"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Kea Control Agent Proxy Fix Complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Changes Applied:"
echo "   - Nginx proxy path updated from /kea/ to /ca/"
echo "   - Nginx restarted with new configuration"
echo "   - Kea Control Agent status verified"
echo ""
echo "🌐 The following pages should now work:"
echo "   - DHCP Manager → Subnets"
echo "   - DHCP Manager → Reservations"
echo "   - DHCP Manager → Leases"
echo "   - High Availability Manager → HA Status"
echo "   - DHCP-DDNS Manager → DDNS Status"
echo "   - Statistics & Monitoring → All tabs"
echo "   - Hooks & Extensions Manager → Hooks Status"
echo ""
echo "💡 If you still see HTTP 405 errors:"
echo "   1. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)"
echo "   2. Check Kea Control Agent logs: sudo tail -f /var/log/kea/kea-ctrl-agent.log"
echo "   3. Verify Kea DHCP4 is running: sudo systemctl status isc-kea-dhcp4-server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

