#!/bin/bash

# Configure Kea DDNS with TSIG secret
# This script updates the Kea configuration with the actual TSIG secret

set -e

echo "=== Configuring Kea DDNS ==="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

# Check if TSIG key file exists
TSIG_KEY_FILE="/etc/bind/keys/sagaos-ddns-key.key"
if [[ ! -f "$TSIG_KEY_FILE" ]]; then
    echo "Error: TSIG key file not found at $TSIG_KEY_FILE"
    echo "Please run bind9-setup.sh first"
    exit 1
fi

# Extract TSIG secret
TSIG_SECRET=$(awk '/secret/ {gsub("\"|;", "", $2); print $2}' $TSIG_KEY_FILE)

if [[ -z "$TSIG_SECRET" ]]; then
    echo "Error: Could not extract TSIG secret from key file"
    exit 1
fi

echo "Found TSIG secret: ${TSIG_SECRET:0:10}..."

# Update Kea configuration with actual TSIG secret
KEA_CONFIG="/home/kea/Kea_Pilot/Saga Os Kea/kea-dhcp4-with-ddns.conf"
KEA_CONFIG_BACKUP="${KEA_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# Create backup
cp "$KEA_CONFIG" "$KEA_CONFIG_BACKUP"
echo "Created backup: $KEA_CONFIG_BACKUP"

# Replace placeholder with actual secret
sed -i "s/REPLACE_WITH_ACTUAL_TSIG_SECRET/$TSIG_SECRET/g" "$KEA_CONFIG"

echo "Updated Kea configuration with TSIG secret"

# Validate JSON configuration
echo "Validating Kea configuration..."
if command -v jq >/dev/null 2>&1; then
    jq . "$KEA_CONFIG" > /dev/null && echo "Configuration JSON is valid"
else
    echo "jq not available, skipping JSON validation"
fi

# Copy configuration to Kea directory
cp "$KEA_CONFIG" /etc/kea/kea-dhcp4.conf
echo "Copied configuration to /etc/kea/kea-dhcp4.conf"

# Create D2 configuration file
cat > /etc/kea/kea-dhcp-ddns.conf << EOF
{
  "DhcpDdns": {
    "ip-address": "127.0.0.1",
    "port": 53001,
    "dns-server-timeout": 5000,
    "ncr-protocol": "UDP",
    "ncr-format": "JSON",
    
    "tsig-keys": [
      {
        "name": "sagaos-ddns-key",
        "algorithm": "HMAC-SHA256",
        "secret": "$TSIG_SECRET"
      }
    ],
    
    "forward-ddns": {
      "ddns-domains": [
        {
          "name": "lan.sagaos.local.",
          "key-name": "sagaos-ddns-key",
          "dns-servers": [
            {
              "ip-address": "127.0.0.1",
              "port": 53
            }
          ]
        }
      ]
    },
    
    "reverse-ddns": {
      "ddns-domains": [
        {
          "name": "0.10.in-addr.arpa.",
          "key-name": "sagaos-ddns-key",
          "dns-servers": [
            {
              "ip-address": "127.0.0.1",
              "port": 53
            }
          ]
        }
      ]
    },
    
    "Logging": {
      "loggers": [
        {
          "name": "kea-dhcp-ddns",
          "output_options": [
            {
              "output": "/var/log/kea/kea-ddns.log",
              "maxver": 8,
              "maxsize": 10485760,
              "flush": true
            }
          ],
          "severity": "INFO",
          "debuglevel": 0
        }
      ]
    }
  }
}
EOF

echo "Created D2 configuration: /etc/kea/kea-dhcp-ddns.conf"

# Create log directory
mkdir -p /var/log/kea
chown kea:kea /var/log/kea

# Enable and restart services
echo "Restarting Kea services..."
systemctl restart isc-kea-dhcp4-server
systemctl enable isc-kea-dhcp-ddns-server
systemctl restart isc-kea-dhcp-ddns-server

# Wait for services to start
sleep 3

# Check service status
echo "Checking service status..."
systemctl status isc-kea-dhcp4-server --no-pager
systemctl status isc-kea-dhcp-ddns-server --no-pager

echo ""
echo "=== Kea DDNS Configuration Complete ==="
echo "DHCP4 Server: Running"
echo "DDNS Server: Running"
echo "TSIG Key: sagaos-ddns-key"
echo "Forward Zone: lan.sagaos.local"
echo "Reverse Zone: 0.10.in-addr.arpa"
