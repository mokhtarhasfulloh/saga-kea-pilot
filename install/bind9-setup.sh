#!/bin/bash

# BIND9 Setup Script for SagaOS Kea Integration
# This script sets up BIND9 with TSIG keys for secure DDNS updates

set -e

echo "=== SagaOS BIND9 Setup ==="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

# Install BIND9 if not already installed
echo "Installing BIND9 packages..."
apt update
apt install -y bind9 bind9utils bind9-dnsutils

# Create TSIG key for secure DDNS
echo "Generating TSIG key for secure DDNS..."
TSIG_KEY_NAME="sagaos-ddns-key"
TSIG_KEY_FILE="/etc/bind/keys/${TSIG_KEY_NAME}.key"

# Create keys directory
mkdir -p /etc/bind/keys

# Generate TSIG key
rndc-confgen -a -k $TSIG_KEY_NAME -A hmac-sha256 -b 256 -c $TSIG_KEY_FILE

# Extract the secret from the key file
TSIG_SECRET=$(awk '/secret/ {gsub("\"|;", "", $2); print $2}' $TSIG_KEY_FILE)

echo "TSIG Key generated: $TSIG_KEY_NAME"
echo "TSIG Secret: $TSIG_SECRET"

# Set proper permissions
chown bind:bind $TSIG_KEY_FILE
chmod 640 $TSIG_KEY_FILE

# Create zone configuration
echo "Setting up zone configuration..."

# Create named.conf.local with zone definitions
cat > /etc/bind/named.conf.local << EOF
// SagaOS DNS Zones Configuration

// Include TSIG key
include "/etc/bind/keys/${TSIG_KEY_NAME}.key";

// Forward zone for LAN
zone "lan.sagaos.local" {
    type master;
    file "/var/lib/bind/db.lan.sagaos.local";
    allow-update { key ${TSIG_KEY_NAME}; };
    notify yes;
};

// Reverse zone for 10.0.0.0/16
zone "0.10.in-addr.arpa" {
    type master;
    file "/var/lib/bind/db.10.0";
    allow-update { key ${TSIG_KEY_NAME}; };
    notify yes;
};
EOF

# Create forward zone file
echo "Creating forward zone file..."
cat > /var/lib/bind/db.lan.sagaos.local << EOF
\$TTL    604800
@       IN      SOA     ns1.lan.sagaos.local. admin.lan.sagaos.local. (
                              1         ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      ns1.lan.sagaos.local.
@       IN      A       10.0.0.53
ns1     IN      A       10.0.0.53
gateway IN      A       10.0.0.1
EOF

# Create reverse zone file
echo "Creating reverse zone file..."
cat > /var/lib/bind/db.10.0 << EOF
\$TTL    604800
@       IN      SOA     ns1.lan.sagaos.local. admin.lan.sagaos.local. (
                              1         ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      ns1.lan.sagaos.local.
53.0    IN      PTR     ns1.lan.sagaos.local.
1.0     IN      PTR     gateway.lan.sagaos.local.
EOF

# Set proper permissions for zone files
chown bind:bind /var/lib/bind/db.*
chmod 644 /var/lib/bind/db.*

# Update named.conf.options for security and performance
echo "Updating BIND9 options..."
cat > /etc/bind/named.conf.options << EOF
options {
    directory "/var/cache/bind";

    // DNS forwarders
    forwarders {
        1.1.1.1;
        9.9.9.9;
    };

    // Security settings
    dnssec-validation auto;
    recursion yes;
    allow-recursion { 10.0.0.0/16; 127.0.0.1; };
    allow-query { 10.0.0.0/16; 127.0.0.1; };
    
    // Listen on all interfaces
    listen-on { any; };
    listen-on-v6 { any; };

    // Disable version disclosure
    version none;
    hostname none;
    server-id none;
};
EOF

# Validate configuration
echo "Validating BIND9 configuration..."
named-checkconf

# Validate zone files
named-checkzone lan.sagaos.local /var/lib/bind/db.lan.sagaos.local
named-checkzone 0.10.in-addr.arpa /var/lib/bind/db.10.0

# Enable and start BIND9
echo "Starting BIND9 service..."
systemctl enable bind9
systemctl restart bind9

# Wait for service to start
sleep 2

# Check service status
systemctl status bind9 --no-pager

echo ""
echo "=== BIND9 Setup Complete ==="
echo "TSIG Key Name: $TSIG_KEY_NAME"
echo "TSIG Secret: $TSIG_SECRET"
echo "Forward Zone: lan.sagaos.local"
echo "Reverse Zone: 0.10.in-addr.arpa"
echo "DNS Server: 10.0.0.53"
echo ""
echo "Save the TSIG secret for Kea D2 configuration!"
echo "TSIG_SECRET=$TSIG_SECRET"
