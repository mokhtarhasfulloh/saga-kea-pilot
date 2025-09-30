#!/bin/bash

# SagaOS Configuration Template Generator
# Generates service configuration files from environment variables
# Supports multiple template formats and validation

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="$PROJECT_ROOT/config/templates"
OUTPUT_DIR="$PROJECT_ROOT/rendered"
ENV_FILE="$PROJECT_ROOT/.env"

echo "🔧 SagaOS Configuration Template Generator"
echo "=========================================="

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] [TEMPLATE_NAME]

Generate service configuration files from templates and environment variables.

OPTIONS:
    -h, --help              Show this help message
    -e, --env-file FILE     Use specific environment file (default: .env)
    -o, --output-dir DIR    Output directory for generated configs (default: rendered/)
    -t, --templates-dir DIR Templates directory (default: config/templates/)
    -v, --validate          Validate generated configurations
    -f, --force             Overwrite existing files without prompting
    --dry-run               Show what would be generated without creating files

TEMPLATE_NAME:
    all                     Generate all available templates (default)
    kea-dhcp4              Generate Kea DHCP4 configuration
    kea-ctrl-agent         Generate Kea Control Agent configuration
    kea-d2                 Generate Kea D2 (DDNS) configuration
    bind9-named            Generate BIND9 named.conf configuration
    bind9-zones            Generate BIND9 zone files
    nginx                  Generate Nginx configuration
    systemd                Generate systemd service files
    docker-compose         Generate Docker Compose configuration

EXAMPLES:
    $0                      # Generate all templates
    $0 kea-dhcp4           # Generate only Kea DHCP4 config
    $0 --validate all      # Generate all and validate
    $0 --dry-run           # Show what would be generated

EOF
}

# Function to load environment variables
load_environment() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        echo "❌ Environment file not found: $env_file"
        echo "   Please create it from .env.example:"
        echo "   cp .env.example .env"
        exit 1
    fi
    
    echo "📋 Loading environment from: $env_file"
    
    # Load environment variables, ignoring comments and empty lines
    set -a
    source <(grep -v '^#' "$env_file" | grep -v '^$' | sed 's/^/export /')
    set +a
    
    echo "✅ Environment loaded successfully"
}

# Function to validate required variables
validate_environment() {
    local missing_vars=()
    
    # Required variables for basic functionality
    local required_vars=(
        "DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD"
        "AUTH_ADMIN_USERNAME" "AUTH_ADMIN_PASSWORD"
        "KEA_CA_USER" "KEA_CA_PASSWORD"
        "DNS_TSIG_SECRET" "DNS_RNDC_SECRET"
    )
    
    echo "🔍 Validating required environment variables..."
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo "❌ Missing required environment variables:"
        printf "   - %s\n" "${missing_vars[@]}"
        echo ""
        echo "Please set these variables in your .env file"
        exit 1
    fi
    
    echo "✅ All required environment variables are set"
}

# Function to substitute environment variables in template
substitute_template() {
    local template_file="$1"
    local output_file="$2"
    
    if [ ! -f "$template_file" ]; then
        echo "❌ Template file not found: $template_file"
        return 1
    fi
    
    echo "  📝 Processing: $(basename "$template_file")"
    
    # Create output directory if it doesn't exist
    mkdir -p "$(dirname "$output_file")"
    
    # Substitute environment variables
    envsubst < "$template_file" > "$output_file"
    
    echo "  ✅ Generated: $output_file"
}

# Function to generate Kea DHCP4 configuration
generate_kea_dhcp4() {
    local output_file="$OUTPUT_DIR/kea/kea-dhcp4.conf"
    
    echo "🏠 Generating Kea DHCP4 configuration..."
    
    cat > "$output_file" << EOF
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
      "name": "${DB_NAME}",
      "user": "${DB_USER}",
      "password": "${DB_PASSWORD}",
      "host": "${DB_HOST}",
      "port": ${DB_PORT}
    },
    "hosts-database": {
      "type": "postgresql",
      "name": "${DB_NAME}",
      "user": "${DB_USER}",
      "password": "${DB_PASSWORD}",
      "host": "${DB_HOST}",
      "port": ${DB_PORT}
    },
    "valid-lifetime": 3600,
    "renew-timer": 1800,
    "rebind-timer": 3000,
    "subnet4": [
      {
        "subnet": "${NETWORK_SUBNET:-10.0.0.0/16}",
        "pools": [
          {
            "pool": "10.0.1.100 - 10.0.1.200"
          }
        ],
        "option-data": [
          {
            "name": "routers",
            "data": "${GATEWAY_IP:-10.0.0.1}"
          },
          {
            "name": "domain-name-servers",
            "data": "${DNS_IP:-10.0.0.53}"
          },
          {
            "name": "domain-name",
            "data": "${DOMAIN:-sagaos.local}"
          }
        ]
      }
    ],
    "dhcp-ddns": {
      "enable-updates": ${DDNS_ENABLED:-true},
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
        "severity": "${LOG_LEVEL:-INFO}",
        "debuglevel": 0
      }
    ]
  }
}
EOF
    
    echo "✅ Generated: $output_file"
}

# Function to generate Kea Control Agent configuration
generate_kea_ctrl_agent() {
    local output_file="$OUTPUT_DIR/kea/kea-ctrl-agent.conf"
    
    echo "🎛️  Generating Kea Control Agent configuration..."
    
    cat > "$output_file" << EOF
{
  "Control-agent": {
    "http-host": "127.0.0.1",
    "http-port": 8000,
    "authentication": {
      "type": "basic",
      "realm": "SagaOS Kea Control Agent",
      "clients": [
        {
          "user": "${KEA_CA_USER}",
          "password": "${KEA_CA_PASSWORD}"
        }
      ]
    },
    "control-sockets": {
      "dhcp4": {
        "socket-type": "unix",
        "socket-name": "/tmp/kea4-ctrl-socket"
      },
      "dhcp6": {
        "socket-type": "unix",
        "socket-name": "/tmp/kea6-ctrl-socket"
      },
      "d2": {
        "socket-type": "unix",
        "socket-name": "/tmp/kea-d2-ctrl-socket"
      }
    },
    "loggers": [
      {
        "name": "kea-ctrl-agent",
        "output_options": [
          {
            "output": "/var/log/kea/kea-ctrl-agent.log",
            "maxver": 10,
            "maxsize": 10485760,
            "flush": true
          }
        ],
        "severity": "${LOG_LEVEL:-INFO}",
        "debuglevel": 0
      }
    ]
  }
}
EOF
    
    echo "✅ Generated: $output_file"
}

# Function to generate Kea D2 (DDNS) configuration
generate_kea_d2() {
    local output_file="$OUTPUT_DIR/kea/kea-d2.conf"

    echo "🔄 Generating Kea D2 (DDNS) configuration..."

    cat > "$output_file" << EOF
{
  "DhcpDdns": {
    "ip-address": "127.0.0.1",
    "port": 53001,
    "dns-server-timeout": 2000,
    "ncr-protocol": "UDP",
    "ncr-format": "JSON",
    "tsig-keys": [
      {
        "name": "${DNS_TSIG_KEY_NAME}",
        "algorithm": "HMAC-SHA256",
        "secret": "${DNS_TSIG_SECRET}"
      }
    ],
    "forward-ddns": {
      "ddns-domains": [
        {
          "name": "${DDNS_FORWARD_ZONE}.",
          "key-name": "${DNS_TSIG_KEY_NAME}",
          "dns-servers": [
            {
              "ip-address": "${DNS_SERVER}",
              "port": ${DNS_PORT}
            }
          ]
        }
      ]
    },
    "reverse-ddns": {
      "ddns-domains": [
        {
          "name": "${DDNS_REVERSE_ZONE}.",
          "key-name": "${DNS_TSIG_KEY_NAME}",
          "dns-servers": [
            {
              "ip-address": "${DNS_SERVER}",
              "port": ${DNS_PORT}
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
        "severity": "${LOG_LEVEL:-INFO}",
        "debuglevel": 0
      }
    ]
  }
}
EOF

    echo "✅ Generated: $output_file"
}

# Function to generate BIND9 named.conf
generate_bind9_named() {
    local output_file="$OUTPUT_DIR/bind9/named.conf.local"
    
    echo "🌐 Generating BIND9 named.conf configuration..."
    
    cat > "$output_file" << EOF
// SagaOS BIND9 Local Configuration
// Generated from template

// Include TSIG key for DDNS updates
include "/etc/bind/keys/${DNS_TSIG_KEY_NAME}.key";

// Control channel configuration for rndc
controls {
    inet ${DNS_RNDC_HOST} port ${DNS_RNDC_PORT}
        allow { 127.0.0.1; } keys { "${DNS_RNDC_KEY}"; };
};

// TSIG key for rndc control
key "${DNS_RNDC_KEY}" {
    algorithm hmac-sha256;
    secret "${DNS_RNDC_SECRET}";
};

// Forward zone for SagaOS
zone "${DDNS_FORWARD_ZONE}." {
    type master;
    file "${DNS_ZONE_DIR}/db.${DDNS_FORWARD_ZONE}";
    allow-update { key ${DNS_TSIG_KEY_NAME}; };
    allow-transfer { key ${DNS_TSIG_KEY_NAME}; };
    notify yes;
};

// Reverse zone
zone "${DDNS_REVERSE_ZONE}." {
    type master;
    file "${DNS_ZONE_DIR}/db.${DDNS_REVERSE_ZONE}";
    allow-update { key ${DNS_TSIG_KEY_NAME}; };
    allow-transfer { key ${DNS_TSIG_KEY_NAME}; };
    notify yes;
};

// Statistics channel for monitoring
statistics-channels {
    inet 127.0.0.1 port 8053 allow { 127.0.0.1; };
};

// Logging configuration
logging {
    channel default_log {
        file "/var/log/bind/default.log" versions 3 size 5m;
        severity info;
        print-time yes;
        print-severity yes;
        print-category yes;
    };
    
    channel query_log {
        file "/var/log/bind/queries.log" versions 3 size 5m;
        severity info;
        print-time yes;
    };
    
    category default { default_log; };
    category queries { query_log; };
    category security { default_log; };
    category update { default_log; };
    category update-security { default_log; };
};
EOF
    
    echo "✅ Generated: $output_file"
}

# Function to generate all templates
generate_all() {
    echo "🔧 Generating all configuration templates..."
    
    mkdir -p "$OUTPUT_DIR"/{kea,bind9,nginx,systemd}
    
    generate_kea_dhcp4
    generate_kea_ctrl_agent
    generate_kea_d2
    generate_bind9_named
    
    echo ""
    echo "🎉 All templates generated successfully!"
    echo "📁 Output directory: $OUTPUT_DIR"
}

# Function to validate generated configurations
validate_configs() {
    echo "🔍 Validating generated configurations..."
    
    local validation_errors=0
    
    # Validate Kea configurations
    if [ -f "$OUTPUT_DIR/kea/kea-dhcp4.conf" ]; then
        echo "  📋 Validating Kea DHCP4 configuration..."
        if command -v kea-dhcp4 >/dev/null 2>&1; then
            if kea-dhcp4 -t "$OUTPUT_DIR/kea/kea-dhcp4.conf" >/dev/null 2>&1; then
                echo "  ✅ Kea DHCP4 configuration is valid"
            else
                echo "  ❌ Kea DHCP4 configuration has errors"
                ((validation_errors++))
            fi
        else
            echo "  ⚠️  Kea DHCP4 not installed, skipping validation"
        fi
    fi
    
    # Validate BIND9 configurations
    if [ -f "$OUTPUT_DIR/bind9/named.conf.local" ]; then
        echo "  📋 Validating BIND9 configuration..."
        if command -v named-checkconf >/dev/null 2>&1; then
            if named-checkconf "$OUTPUT_DIR/bind9/named.conf.local" >/dev/null 2>&1; then
                echo "  ✅ BIND9 configuration is valid"
            else
                echo "  ❌ BIND9 configuration has errors"
                ((validation_errors++))
            fi
        else
            echo "  ⚠️  BIND9 not installed, skipping validation"
        fi
    fi
    
    if [ $validation_errors -eq 0 ]; then
        echo "✅ All configurations are valid"
        return 0
    else
        echo "❌ $validation_errors configuration(s) have errors"
        return 1
    fi
}

# Parse command line arguments
VALIDATE=false
FORCE=false
DRY_RUN=false
TEMPLATE_NAME="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -e|--env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -o|--output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -t|--templates-dir)
            TEMPLATES_DIR="$2"
            shift 2
            ;;
        -v|--validate)
            VALIDATE=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -*)
            echo "❌ Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            TEMPLATE_NAME="$1"
            shift
            ;;
    esac
done

# Main execution
main() {
    echo "📋 Configuration:"
    echo "  Environment file: $ENV_FILE"
    echo "  Templates directory: $TEMPLATES_DIR"
    echo "  Output directory: $OUTPUT_DIR"
    echo "  Template: $TEMPLATE_NAME"
    echo "  Validate: $VALIDATE"
    echo "  Dry run: $DRY_RUN"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        echo "🔍 DRY RUN MODE - No files will be created"
        echo ""
    fi
    
    # Load and validate environment
    load_environment "$ENV_FILE"
    validate_environment
    
    if [ "$DRY_RUN" = true ]; then
        echo "✅ Dry run complete - all validations passed"
        exit 0
    fi
    
    # Generate templates
    case "$TEMPLATE_NAME" in
        all)
            generate_all
            ;;
        kea-dhcp4)
            generate_kea_dhcp4
            ;;
        kea-ctrl-agent)
            generate_kea_ctrl_agent
            ;;
        kea-d2)
            generate_kea_d2
            ;;
        bind9-named)
            generate_bind9_named
            ;;
        *)
            echo "❌ Unknown template: $TEMPLATE_NAME"
            echo "Use --help to see available templates"
            exit 1
            ;;
    esac
    
    # Validate if requested
    if [ "$VALIDATE" = true ]; then
        echo ""
        validate_configs
    fi
    
    echo ""
    echo "🎉 Template generation complete!"
}

# Run main function
main "$@"
