#!/bin/bash

# SagaOS Configuration Generator
# Generates service configurations with admin/admin credentials
# Supports environment variable substitution

set -euo pipefail

echo "⚙️  Generating SagaOS Service Configurations"
echo "============================================="

# Default values
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kea}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-admin}"
DOMAIN="${DOMAIN:-sagaos.local}"
NETWORK="${NETWORK:-10.0.0.0/16}"

# TSIG secret (base64 encoded admin credentials)
TSIG_SECRET="YWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbg=="

echo "📋 Configuration Parameters:"
echo "  Domain: $DOMAIN"
echo "  Network: $NETWORK"
echo "  Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "  Admin User: $ADMIN_USER"
echo ""

# Function to substitute environment variables in template
substitute_template() {
    local template_file="$1"
    local output_file="$2"
    
    if [ ! -f "$template_file" ]; then
        echo "❌ Template file not found: $template_file"
        return 1
    fi
    
    # Create output directory if it doesn't exist
    mkdir -p "$(dirname "$output_file")"
    
    # Substitute variables
    envsubst < "$template_file" > "$output_file"
    echo "✅ Generated: $output_file"
}

# Function to generate Kea DHCP4 configuration
generate_kea_dhcp4() {
    echo "🏠 Generating Kea DHCP4 configuration..."
    
    cat > "rendered/kea-dhcp4.conf" << EOF
{
  "Dhcp4": {
    "interfaces-config": {
      "interfaces": ["*"]
    },
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/tmp/kea4-ctrl-socket"
    },
    "lease-database": {
      "type": "postgresql",
      "name": "$DB_NAME",
      "user": "$DB_USER",
      "password": "$DB_PASSWORD",
      "host": "$DB_HOST",
      "port": $DB_PORT
    },
    "hosts-database": {
      "type": "postgresql",
      "name": "$DB_NAME",
      "user": "$DB_USER",
      "password": "$DB_PASSWORD",
      "host": "$DB_HOST",
      "port": $DB_PORT
    },
    "valid-lifetime": 3600,
    "renew-timer": 1800,
    "rebind-timer": 3000,
    "subnet4": [
      {
        "subnet": "$NETWORK",
        "pools": [
          {
            "pool": "10.0.1.100 - 10.0.1.200"
          }
        ],
        "option-data": [
          {
            "name": "routers",
            "data": "10.0.0.1"
          },
          {
            "name": "domain-name-servers",
            "data": "10.0.0.53"
          },
          {
            "name": "domain-name",
            "data": "$DOMAIN"
          }
        ]
      }
    ],
    "dhcp-ddns": {
      "enable-updates": true,
      "server-ip": "127.0.0.1",
      "server-port": 53001,
      "sender-ip": "127.0.0.1",
      "sender-port": 0,
      "max-queue-size": 1024,
      "ncr-protocol": "UDP",
      "ncr-format": "JSON"
    },
    "hooks-libraries": [
      {
        "library": "/usr/lib/kea/hooks/libdhcp_lease_cmds.so"
      },
      {
        "library": "/usr/lib/kea/hooks/libdhcp_host_cmds.so"
      },
      {
        "library": "/usr/lib/kea/hooks/libdhcp_subnet_cmds.so"
      }
    ],
    "loggers": [
      {
        "name": "kea-dhcp4",
        "output_options": [
          {
            "output": "/var/log/kea/kea-dhcp4.log",
            "maxver": 10,
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
EOF
    
    echo "✅ Generated: rendered/kea-dhcp4.conf"
}

# Function to generate Kea D2 (DDNS) configuration
generate_kea_d2() {
    echo "🔄 Generating Kea D2 (DDNS) configuration..."
    
    cat > "rendered/kea-d2.conf" << EOF
{
  "DhcpDdns": {
    "ip-address": "127.0.0.1",
    "port": 53001,
    "dns-server-timeout": 2000,
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
          "name": "$DOMAIN.",
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
    "loggers": [
      {
        "name": "kea-d2",
        "output_options": [
          {
            "output": "/var/log/kea/kea-d2.log",
            "maxver": 10,
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
EOF
    
    echo "✅ Generated: rendered/kea-d2.conf"
}

# Function to generate systemd service files
generate_systemd_services() {
    echo "🔧 Generating systemd service files..."
    
    mkdir -p rendered/systemd
    
    # SagaOS API Gateway service
    cat > "rendered/systemd/sagaos-api.service" << EOF
[Unit]
Description=SagaOS API Gateway
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=sagaos
Group=sagaos
WorkingDirectory=/opt/sagaos
ExecStart=/usr/bin/node backend/api-gateway.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/sagaos/.env

[Install]
WantedBy=multi-user.target
EOF
    
    echo "✅ Generated: rendered/systemd/sagaos-api.service"
}

# Main execution
main() {
    echo "Starting configuration generation..."
    
    # Create rendered directory
    mkdir -p rendered
    
    # Generate configurations
    generate_kea_dhcp4
    generate_kea_d2
    generate_systemd_services
    
    echo ""
    echo "🎉 Configuration generation complete!"
    echo ""
    echo "📁 Generated files in rendered/ directory:"
    echo "  ✅ rendered/kea-dhcp4.conf"
    echo "  ✅ rendered/kea-d2.conf"
    echo "  ✅ rendered/systemd/sagaos-api.service"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Review generated configurations"
    echo "  2. Copy to appropriate system locations"
    echo "  3. Restart services"
    echo ""
    echo "⚠️  Remember to secure credentials for production!"
}

# Run main function
main "$@"
