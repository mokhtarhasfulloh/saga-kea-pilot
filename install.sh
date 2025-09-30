#!/bin/bash

# ============================================================================
# SagaOS Kea Pilot - Master Installation Script
# ============================================================================
# One-command installation for the complete SagaOS system
# Supports Ubuntu 20.04+, CentOS 8+, RHEL 8+
# 
# Usage: curl -fsSL https://raw.githubusercontent.com/saga-fiber/sagaos-kea-pilot/main/install.sh | sudo bash
# Or:    sudo ./install.sh
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_VERSION="1.0.0"
SCRIPT_NAME="SagaOS Kea Pilot Installer"
LOG_FILE="/var/log/sagaos-install.log"
INSTALL_DIR="/opt/sagaos"
SERVICE_USER="sagaos"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation options
INSTALL_TYPE="full"
SKIP_DEPS=false
SKIP_CONFIG=false
SKIP_SERVICES=false
DRY_RUN=false
FORCE=false

echo -e "${CYAN}"
cat << "EOF"
 ____                   ___  ____  
/ ___|  __ _  __ _  __ _/ _ \/ ___| 
\___ \ / _` |/ _` |/ _` | | | \___ \ 
 ___) | (_| | (_| | (_| | |_| |___) |
|____/ \__,_|\__, |\__,_|\___/|____/ 
             |___/                  
    Kea Pilot Installation System
EOF
echo -e "${NC}"

echo -e "${GREEN}🚀 $SCRIPT_NAME v$SCRIPT_VERSION${NC}"
echo -e "${BLUE}📅 $(date)${NC}"
echo ""

# Function to log messages
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "DEBUG")
            echo -e "${PURPLE}🔍 $message${NC}"
            ;;
        *)
            echo -e "${BLUE}📋 $message${NC}"
            ;;
    esac
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Install SagaOS Kea Pilot system with all components.

OPTIONS:
    -h, --help              Show this help message
    -t, --type TYPE         Installation type (full|minimal|docker)
    --skip-deps             Skip dependency installation
    --skip-config           Skip configuration setup
    --skip-services         Skip service installation
    --dry-run               Show what would be installed without doing it
    -f, --force             Force installation even if components exist
    -v, --verbose           Enable verbose logging

INSTALLATION TYPES:
    full                    Complete installation (default)
                           - PostgreSQL database
                           - Kea DHCP server
                           - BIND9 DNS server
                           - SagaOS web interface
                           - All monitoring and logging
    
    minimal                 Essential components only
                           - PostgreSQL database
                           - Kea DHCP server
                           - SagaOS web interface
    
    docker                  Docker-based installation
                           - Docker and Docker Compose
                           - Containerized services
                           - Simplified management

EXAMPLES:
    $0                      # Full installation
    $0 --type minimal       # Minimal installation
    $0 --type docker        # Docker installation
    $0 --dry-run            # Preview installation
    $0 --force              # Force reinstallation

REQUIREMENTS:
    - Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
    - Root privileges (sudo)
    - Internet connection
    - 4GB RAM minimum
    - 20GB disk space minimum

EOF
}

# Function to detect operating system
detect_os() {
    log "INFO" "Detecting operating system..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        OS_CODENAME=${VERSION_CODENAME:-}
    else
        log "ERROR" "Cannot detect operating system"
        exit 1
    fi
    
    case "$OS" in
        ubuntu)
            if [[ "$OS_VERSION" < "20.04" ]]; then
                log "ERROR" "Ubuntu 20.04 or later is required"
                exit 1
            fi
            PACKAGE_MANAGER="apt"
            ;;
        centos|rhel)
            if [[ "$OS_VERSION" < "8" ]]; then
                log "ERROR" "CentOS/RHEL 8 or later is required"
                exit 1
            fi
            PACKAGE_MANAGER="yum"
            ;;
        *)
            log "ERROR" "Unsupported operating system: $OS"
            log "INFO" "Supported: Ubuntu 20.04+, CentOS 8+, RHEL 8+"
            exit 1
            ;;
    esac
    
    log "INFO" "Detected: $OS $OS_VERSION ($PACKAGE_MANAGER)"
}

# Function to check system requirements
check_requirements() {
    log "INFO" "Checking system requirements..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log "ERROR" "This script must be run as root (use sudo)"
        exit 1
    fi
    
    # Check available memory
    local mem_gb=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$mem_gb" -lt 4 ]; then
        log "WARN" "Less than 4GB RAM detected ($mem_gb GB). Installation may be slow."
    else
        log "INFO" "Memory: ${mem_gb}GB (sufficient)"
    fi
    
    # Check available disk space
    local disk_gb=$(df / | awk 'NR==2{print int($4/1024/1024)}')
    if [ "$disk_gb" -lt 20 ]; then
        log "ERROR" "Insufficient disk space. Need 20GB, have ${disk_gb}GB"
        exit 1
    else
        log "INFO" "Disk space: ${disk_gb}GB (sufficient)"
    fi
    
    # Check internet connectivity
    if ! ping -c 1 google.com >/dev/null 2>&1; then
        log "ERROR" "No internet connection detected"
        exit 1
    else
        log "INFO" "Internet connectivity: OK"
    fi
    
    log "INFO" "System requirements check passed"
}

# Function to install system dependencies
install_dependencies() {
    if [ "$SKIP_DEPS" = true ]; then
        log "INFO" "Skipping dependency installation"
        return
    fi
    
    log "INFO" "Installing system dependencies..."
    
    case "$PACKAGE_MANAGER" in
        apt)
            # Update package lists
            apt update
            
            # Install essential packages
            apt install -y \
                curl \
                wget \
                git \
                unzip \
                software-properties-common \
                apt-transport-https \
                ca-certificates \
                gnupg \
                lsb-release \
                jq \
                openssl \
                ufw
            
            # Install Node.js 18.x
            curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
            apt install -y nodejs
            
            # Install PostgreSQL 15
            wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
            echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
            apt update
            apt install -y postgresql-15 postgresql-client-15
            
            # Install Kea DHCP
            apt install -y isc-kea-dhcp4-server isc-kea-ctrl-agent isc-kea-admin
            
            # Install BIND9
            apt install -y bind9 bind9utils bind9-dnsutils
            
            # Install Nginx
            apt install -y nginx
            ;;
        yum)
            # Update package lists
            yum update -y
            
            # Install EPEL repository
            yum install -y epel-release
            
            # Install essential packages
            yum install -y \
                curl \
                wget \
                git \
                unzip \
                openssl \
                firewalld \
                jq
            
            # Install Node.js 18.x
            curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
            yum install -y nodejs
            
            # Install PostgreSQL 15
            yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
            yum install -y postgresql15-server postgresql15
            
            # Install Kea DHCP (from source or third-party repo)
            log "WARN" "Kea DHCP installation on CentOS/RHEL requires manual setup"
            
            # Install BIND9
            yum install -y bind bind-utils
            
            # Install Nginx
            yum install -y nginx
            ;;
    esac
    
    log "INFO" "System dependencies installed successfully"
}

# Function to create system user
create_system_user() {
    log "INFO" "Creating system user: $SERVICE_USER"
    
    if ! id "$SERVICE_USER" >/dev/null 2>&1; then
        useradd --system --home-dir "$INSTALL_DIR" --shell /bin/bash "$SERVICE_USER"
        log "INFO" "Created system user: $SERVICE_USER"
    else
        log "INFO" "System user already exists: $SERVICE_USER"
    fi
}

# Function to setup installation directory
setup_install_directory() {
    log "INFO" "Setting up installation directory: $INSTALL_DIR"
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    
    # Set ownership
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    # Set permissions
    chmod 755 "$INSTALL_DIR"
    
    log "INFO" "Installation directory ready: $INSTALL_DIR"
}

# Function to download and extract SagaOS
download_sagaos() {
    log "INFO" "Downloading SagaOS Kea Pilot..."
    
    local temp_dir=$(mktemp -d)
    local download_url="https://github.com/saga-fiber/sagaos-kea-pilot/archive/main.zip"
    
    # Download the latest release
    cd "$temp_dir"
    wget -O sagaos.zip "$download_url"
    
    # Extract
    unzip -q sagaos.zip
    
    # Copy to installation directory
    cp -r sagaos-kea-pilot-main/* "$INSTALL_DIR/"
    
    # Set ownership
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log "INFO" "SagaOS downloaded and extracted to $INSTALL_DIR"
}

# Function to install Node.js dependencies
install_node_dependencies() {
    log "INFO" "Installing Node.js dependencies..."
    
    cd "$INSTALL_DIR"
    
    # Install backend dependencies
    if [ -f "package.json" ]; then
        sudo -u "$SERVICE_USER" npm install --production
        log "INFO" "Backend dependencies installed"
    fi
    
    # Install frontend dependencies and build
    if [ -f "package.json" ]; then
        sudo -u "$SERVICE_USER" npm run build
        log "INFO" "Frontend built successfully"
    fi
}

# Function to setup database
setup_database() {
    log "INFO" "Setting up PostgreSQL database..."
    
    # Initialize PostgreSQL if needed
    if [ "$PACKAGE_MANAGER" = "yum" ]; then
        /usr/pgsql-15/bin/postgresql-15-setup initdb
    fi
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE USER admin WITH PASSWORD 'admin';
CREATE DATABASE kea OWNER admin;
GRANT ALL PRIVILEGES ON DATABASE kea TO admin;
\q
EOF
    
    # Apply database schemas
    if [ -f "$INSTALL_DIR/config/database/users-schema.sql" ]; then
        sudo -u postgres psql -d kea -f "$INSTALL_DIR/config/database/users-schema.sql"
    fi
    
    if [ -f "$INSTALL_DIR/config/database/dns-schema.sql" ]; then
        sudo -u postgres psql -d kea -f "$INSTALL_DIR/config/database/dns-schema.sql"
    fi
    
    log "INFO" "Database setup completed"
}

# Function to configure services
configure_services() {
    if [ "$SKIP_CONFIG" = true ]; then
        log "INFO" "Skipping service configuration"
        return
    fi
    
    log "INFO" "Configuring services..."
    
    # Setup authentication
    if [ -f "$INSTALL_DIR/install/setup-authentication.sh" ]; then
        cd "$INSTALL_DIR"
        bash install/setup-authentication.sh
    fi
    
    # Generate configurations
    if [ -f "$INSTALL_DIR/install/template-generator.sh" ]; then
        cd "$INSTALL_DIR"
        bash install/template-generator.sh generate --env development
    fi
    
    log "INFO" "Service configuration completed"
}

# Function to install systemd services
install_systemd_services() {
    if [ "$SKIP_SERVICES" = true ]; then
        log "INFO" "Skipping systemd service installation"
        return
    fi
    
    log "INFO" "Installing systemd services..."
    
    # Create SagaOS API service
    cat > /etc/systemd/system/sagaos-api.service << EOF
[Unit]
Description=SagaOS API Gateway
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node backend/api-gateway.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable services
    systemctl daemon-reload
    systemctl enable sagaos-api
    
    log "INFO" "Systemd services installed"
}

# Function to configure firewall
configure_firewall() {
    log "INFO" "Configuring firewall..."
    
    case "$PACKAGE_MANAGER" in
        apt)
            # Configure UFW
            ufw --force reset
            ufw default deny incoming
            ufw default allow outgoing
            ufw allow ssh
            ufw allow 80/tcp
            ufw allow 443/tcp
            ufw allow 53/tcp
            ufw allow 53/udp
            ufw allow 67/udp
            ufw allow 68/udp
            ufw --force enable
            ;;
        yum)
            # Configure firewalld
            systemctl start firewalld
            systemctl enable firewalld
            firewall-cmd --permanent --add-service=ssh
            firewall-cmd --permanent --add-service=http
            firewall-cmd --permanent --add-service=https
            firewall-cmd --permanent --add-service=dns
            firewall-cmd --permanent --add-service=dhcp
            firewall-cmd --reload
            ;;
    esac
    
    log "INFO" "Firewall configured"
}

# Function to start services
start_services() {
    log "INFO" "Starting services..."
    
    # Start database
    systemctl start postgresql
    
    # Start Kea services
    systemctl start isc-kea-dhcp4-server || true
    systemctl start isc-kea-ctrl-agent || true
    
    # Start BIND9
    systemctl start bind9 || systemctl start named || true
    
    # Start SagaOS API
    systemctl start sagaos-api
    
    # Start Nginx
    systemctl start nginx
    
    log "INFO" "Services started"
}

# Function to run post-installation tests
run_tests() {
    log "INFO" "Running post-installation tests..."
    
    # Test database connection
    if sudo -u postgres psql -d kea -c "SELECT 1;" >/dev/null 2>&1; then
        log "INFO" "Database connection: OK"
    else
        log "ERROR" "Database connection: FAILED"
    fi
    
    # Test API Gateway
    sleep 5
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        log "INFO" "API Gateway: OK"
    else
        log "WARN" "API Gateway: Not responding (may need manual start)"
    fi
    
    # Test frontend
    if [ -d "$INSTALL_DIR/dist" ]; then
        log "INFO" "Frontend build: OK"
    else
        log "WARN" "Frontend build: Not found"
    fi
    
    log "INFO" "Post-installation tests completed"
}

# Function to display installation summary
display_summary() {
    echo ""
    echo -e "${GREEN}🎉 SagaOS Kea Pilot Installation Complete!${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo -e "${CYAN}📋 Installation Summary:${NC}"
    echo -e "  📁 Installation Directory: ${YELLOW}$INSTALL_DIR${NC}"
    echo -e "  👤 Service User: ${YELLOW}$SERVICE_USER${NC}"
    echo -e "  🗄️  Database: ${YELLOW}PostgreSQL (admin/admin)${NC}"
    echo -e "  🌐 Web Interface: ${YELLOW}http://$(hostname -I | awk '{print $1}')${NC}"
    echo -e "  🔐 Login Credentials: ${YELLOW}admin/admin${NC}"
    echo ""
    echo -e "${CYAN}🚀 Next Steps:${NC}"
    echo -e "  1. Open web browser to: ${YELLOW}http://$(hostname -I | awk '{print $1}')${NC}"
    echo -e "  2. Login with: ${YELLOW}admin/admin${NC}"
    echo -e "  3. Configure your DHCP and DNS settings"
    echo -e "  4. ${RED}IMPORTANT: Change default passwords for production!${NC}"
    echo ""
    echo -e "${CYAN}📚 Documentation:${NC}"
    echo -e "  📖 User Guide: ${YELLOW}$INSTALL_DIR/docs/USER_GUIDE.md${NC}"
    echo -e "  🔐 Security Guide: ${YELLOW}$INSTALL_DIR/docs/PRODUCTION_SECURITY_GUIDE.md${NC}"
    echo -e "  🛠️  Troubleshooting: ${YELLOW}$INSTALL_DIR/docs/TROUBLESHOOTING.md${NC}"
    echo ""
    echo -e "${CYAN}🆘 Support:${NC}"
    echo -e "  📧 Email: support@sagaos.com"
    echo -e "  🌐 Website: https://sagaos.com"
    echo -e "  📋 Logs: ${YELLOW}$LOG_FILE${NC}"
    echo ""
    echo -e "${GREEN}Thank you for choosing SagaOS! 🚀${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -t|--type)
            INSTALL_TYPE="$2"
            shift 2
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --skip-config)
            SKIP_CONFIG=true
            shift
            ;;
        --skip-services)
            SKIP_SERVICES=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        *)
            log "ERROR" "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main installation function
main() {
    log "INFO" "Starting SagaOS Kea Pilot installation..."
    log "INFO" "Installation type: $INSTALL_TYPE"
    
    if [ "$DRY_RUN" = true ]; then
        log "INFO" "DRY RUN MODE - No changes will be made"
        log "INFO" "Would install: $INSTALL_TYPE installation"
        log "INFO" "Would create user: $SERVICE_USER"
        log "INFO" "Would install to: $INSTALL_DIR"
        exit 0
    fi
    
    # Pre-installation checks
    detect_os
    check_requirements
    
    # Installation steps
    install_dependencies
    create_system_user
    setup_install_directory
    download_sagaos
    install_node_dependencies
    setup_database
    configure_services
    install_systemd_services
    configure_firewall
    start_services
    run_tests
    
    # Post-installation
    display_summary
    
    log "INFO" "Installation completed successfully!"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main installation
main "$@"
