#!/bin/bash

# SagaOS DNS Integration Setup Script
# Complete setup for BIND9 + Kea DHCP + DDNS integration

set -e

echo "========================================"
echo "    SagaOS DNS Integration Setup"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Check if we're in the correct directory
if [[ ! -f "bind9-setup.sh" ]] || [[ ! -f "configure-kea-ddns.sh" ]]; then
    print_error "Please run this script from the SagaOS project directory"
    print_error "Required files: bind9-setup.sh, configure-kea-ddns.sh"
    exit 1
fi

print_status "Starting SagaOS DNS integration setup..."

# Step 1: Install and configure BIND9
print_status "Step 1: Setting up BIND9 DNS server..."
if ./bind9-setup.sh; then
    print_success "BIND9 setup completed"
else
    print_error "BIND9 setup failed"
    exit 1
fi

echo ""

# Step 2: Configure Kea DDNS
print_status "Step 2: Configuring Kea DDNS integration..."
if ./configure-kea-ddns.sh; then
    print_success "Kea DDNS configuration completed"
else
    print_error "Kea DDNS configuration failed"
    exit 1
fi

echo ""

# Step 3: Setup DNS database schema
print_status "Step 3: Setting up DNS database schema..."
if ./setup-dns-database.sh; then
    print_success "DNS database schema setup completed"
else
    print_error "DNS database schema setup failed"
    exit 1
fi

echo ""

# Step 4: Install Node.js dependencies for API Gateway
print_status "Step 4: Installing API Gateway dependencies..."
if command -v npm >/dev/null 2>&1; then
    if npm install; then
        print_success "Node.js dependencies installed"
    else
        print_warning "Failed to install Node.js dependencies"
        print_warning "You may need to run 'npm install' manually"
    fi
else
    print_warning "npm not found - skipping Node.js dependency installation"
    print_warning "Please install Node.js and run 'npm install' manually"
fi

echo ""

# Step 5: Create environment configuration
print_status "Step 5: Creating environment configuration..."

# Create backend environment file if it doesn't exist
if [[ ! -f ".env" ]]; then
    cp .env.backend.example .env
    print_success "Created .env file from template"
    print_warning "Please review and update .env with your specific configuration"
else
    print_warning ".env file already exists - skipping creation"
fi

# Create frontend environment file if it doesn't exist
if [[ ! -f ".env.development" ]]; then
    cp .env.example .env.development
    print_success "Created .env.development file from template"
else
    print_warning ".env.development file already exists - skipping creation"
fi

echo ""

# Step 6: Test the integration
print_status "Step 6: Testing DNS integration..."

# Test BIND9 status
print_status "Testing BIND9 status..."
if systemctl is-active --quiet bind9; then
    print_success "BIND9 is running"
else
    print_error "BIND9 is not running"
    exit 1
fi

# Test Kea DHCP status
print_status "Testing Kea DHCP status..."
if systemctl is-active --quiet isc-kea-dhcp4-server; then
    print_success "Kea DHCP4 server is running"
else
    print_error "Kea DHCP4 server is not running"
    exit 1
fi

# Test Kea DDNS status
print_status "Testing Kea DDNS status..."
if systemctl is-active --quiet isc-kea-dhcp-ddns-server; then
    print_success "Kea DDNS server is running"
else
    print_warning "Kea DDNS server is not running - this is optional"
fi

# Test DNS resolution
print_status "Testing DNS resolution..."
if dig @127.0.0.1 lan.sagaos.local SOA +short >/dev/null 2>&1; then
    print_success "DNS resolution is working"
else
    print_warning "DNS resolution test failed - zone may not be fully configured"
fi

# Test database connection
print_status "Testing database connection..."
if sudo -u kea psql -d kea -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "Database connection is working"
else
    print_error "Database connection failed"
    exit 1
fi

echo ""

# Step 7: Display configuration summary
print_status "Configuration Summary:"
echo "----------------------------------------"
echo "DNS Server: 127.0.0.1:53"
echo "Forward Zone: lan.sagaos.local"
echo "Reverse Zone: 0.10.in-addr.arpa"
echo "TSIG Key: sagaos-ddns-key"
echo "DDNS Server: 127.0.0.1:53001"
echo "API Gateway: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo "----------------------------------------"

echo ""

# Step 8: Display next steps
print_success "SagaOS DNS Integration Setup Complete!"
echo ""
echo "Next Steps:"
echo "1. Start the API Gateway:"
echo "   node api-gateway.cjs"
echo ""
echo "2. Start the frontend development server:"
echo "   npm run dev"
echo ""
echo "3. Access the SagaOS interface at:"
echo "   http://localhost:5173"
echo ""
echo "4. Test DNS management in the DNS Manager section"
echo ""
echo "5. Monitor logs:"
echo "   - BIND9: /var/log/syslog"
echo "   - Kea DHCP: /var/log/kea/kea-dhcp4.log"
echo "   - Kea DDNS: /var/log/kea/kea-ddns.log"
echo ""

# Step 9: Display troubleshooting information
echo "Troubleshooting:"
echo "- Check service status: systemctl status bind9 isc-kea-dhcp4-server isc-kea-dhcp-ddns-server"
echo "- Test DNS queries: dig @127.0.0.1 lan.sagaos.local"
echo "- Test DDNS updates: see test-ddns-update.sh"
echo "- Check logs: journalctl -u bind9 -f"
echo ""

print_success "Setup completed successfully!"
print_status "You can now manage DNS through the SagaOS web interface."

echo ""
echo "========================================"
echo "    Setup Complete - Enjoy SagaOS!"
echo "========================================"
