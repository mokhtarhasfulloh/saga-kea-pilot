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

# Ensure non-interactive mode for package installations
export DEBIAN_FRONTEND=noninteractive

# Global error tracking
INSTALLATION_ERRORS=0
CRITICAL_ERRORS=0
WARNING_COUNT=0

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
            ((WARNING_COUNT++))
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ((INSTALLATION_ERRORS++))
            ;;
        "CRITICAL")
            echo -e "${RED}🚨 CRITICAL: $message${NC}"
            ((CRITICAL_ERRORS++))
            ((INSTALLATION_ERRORS++))
            ;;
        "SUCCESS")
            echo -e "${GREEN}🎉 $message${NC}"
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

# Enhanced error handling functions
handle_package_error() {
    local package_name="$1"
    local error_message="$2"
    local is_critical="${3:-false}"

    if [ "$is_critical" = "true" ]; then
        log "CRITICAL" "Failed to install critical package: $package_name"
        log "ERROR" "$error_message"
        log "ERROR" "Installation cannot continue without $package_name"
        exit 1
    else
        log "ERROR" "Failed to install package: $package_name"
        log "WARN" "$error_message"
        log "INFO" "Installation will continue, but some features may not work"
    fi
}

# Verify package installation
verify_package_installed() {
    local package_name="$1"
    local package_manager="$2"

    case "$package_manager" in
        apt)
            if dpkg -l | grep -q "^ii  $package_name "; then
                log "SUCCESS" "Package $package_name installed successfully"
                return 0
            fi
            ;;
        yum)
            if rpm -q "$package_name" >/dev/null 2>&1; then
                log "SUCCESS" "Package $package_name installed successfully"
                return 0
            fi
            ;;
    esac

    return 1
}

# Install package with retry and error handling
install_package_with_retry() {
    local package_name="$1"
    local package_manager="$2"
    local is_critical="${3:-false}"
    local max_retries=3
    local retry_count=0

    log "INFO" "Installing package: $package_name"

    while [ $retry_count -lt $max_retries ]; do
        case "$package_manager" in
            apt)
                if apt install -y "$package_name" >/dev/null 2>&1; then
                    if verify_package_installed "$package_name" "$package_manager"; then
                        return 0
                    fi
                fi
                ;;
            yum)
                if yum install -y "$package_name" >/dev/null 2>&1; then
                    if verify_package_installed "$package_name" "$package_manager"; then
                        return 0
                    fi
                fi
                ;;
        esac

        ((retry_count++))
        if [ $retry_count -lt $max_retries ]; then
            log "WARN" "Package installation failed, retrying ($retry_count/$max_retries)..."
            sleep 2
        fi
    done

    handle_package_error "$package_name" "Failed after $max_retries attempts" "$is_critical"
    return 1
}

# Add repository safely with error handling
add_repository_safely() {
    local repo_description="$1"
    local repo_command="$2"
    local is_critical="${3:-false}"

    log "INFO" "Adding repository: $repo_description"

    if eval "$repo_command" >/dev/null 2>&1; then
        log "SUCCESS" "Repository added: $repo_description"
        return 0
    else
        if [ "$is_critical" = "true" ]; then
            log "CRITICAL" "Failed to add critical repository: $repo_description"
            exit 1
        else
            log "ERROR" "Failed to add repository: $repo_description"
            return 1
        fi
    fi
}

# Setup Kea DHCP repository
setup_kea_repository() {
    log "INFO" "Setting up Kea DHCP repository..."

    case "$PACKAGE_MANAGER" in
        apt)
            # Try ISC Kea official repository first
            if add_repository_safely "ISC Kea Repository" "curl -1sLf 'https://dl.cloudsmith.io/public/isc/kea-3-0/setup.deb.sh' | bash"; then
                apt update >/dev/null 2>&1
                log "SUCCESS" "ISC Kea repository added successfully"
                return 0
            fi

            # Fallback: Try to enable universe repository for older Kea packages
            log "WARN" "ISC repository failed, trying universe repository..."
            if add_repository_safely "Universe Repository" "add-apt-repository universe -y"; then
                apt update >/dev/null 2>&1
                log "INFO" "Universe repository enabled (may have older Kea packages)"
                return 0
            fi

            log "ERROR" "Failed to add any Kea repository"
            return 1
            ;;
        yum)
            log "WARN" "Kea DHCP installation on CentOS/RHEL requires manual setup"
            log "INFO" "Please refer to: https://kea.readthedocs.io/en/latest/arm/install.html"
            return 1
            ;;
    esac
}

# Install Kea DHCP packages with fallback options
install_kea_packages() {
    log "INFO" "Installing Kea DHCP packages..."

    # Setup repository first
    if ! setup_kea_repository; then
        log "ERROR" "Cannot install Kea packages without repository"
        return 1
    fi

    case "$PACKAGE_MANAGER" in
        apt)
            # Try official ISC package names first
            local kea_packages=("isc-kea-dhcp4-server" "isc-kea-ctrl-agent" "isc-kea-admin" "isc-kea-common")
            local installed_packages=0

            for package in "${kea_packages[@]}"; do
                if install_package_with_retry "$package" "$PACKAGE_MANAGER" false; then
                    ((installed_packages++))
                fi
            done

            # If official packages failed, try alternative names
            if [ $installed_packages -eq 0 ]; then
                log "WARN" "Official Kea packages failed, trying alternative names..."
                local alt_packages=("kea-dhcp4-server" "kea-ctrl-agent" "kea-admin" "kea-common")

                for package in "${alt_packages[@]}"; do
                    if install_package_with_retry "$package" "$PACKAGE_MANAGER" false; then
                        ((installed_packages++))
                    fi
                done
            fi

            if [ $installed_packages -gt 0 ]; then
                log "SUCCESS" "Kea DHCP packages installed ($installed_packages packages)"
                return 0
            else
                log "ERROR" "Failed to install any Kea DHCP packages"
                log "INFO" "Manual installation may be required"
                return 1
            fi
            ;;
        yum)
            log "ERROR" "Kea DHCP installation on CentOS/RHEL requires manual setup"
            return 1
            ;;
    esac
}

# Enhanced service management functions
start_service_with_retry() {
    local service_name="$1"
    local is_critical="${2:-false}"
    local max_retries=3
    local retry_count=0

    log "INFO" "Starting service: $service_name"

    while [ $retry_count -lt $max_retries ]; do
        if systemctl start "$service_name" >/dev/null 2>&1; then
            sleep 2  # Give service time to start
            if systemctl is-active --quiet "$service_name"; then
                log "SUCCESS" "Service $service_name started successfully"
                return 0
            fi
        fi

        ((retry_count++))
        if [ $retry_count -lt $max_retries ]; then
            log "WARN" "Service startup failed, retrying ($retry_count/$max_retries)..."
            sleep 3
        fi
    done

    if [ "$is_critical" = "true" ]; then
        log "CRITICAL" "Failed to start critical service: $service_name"
        log "ERROR" "Installation cannot continue without $service_name"
        exit 1
    else
        log "ERROR" "Failed to start service: $service_name"
        log "INFO" "You may need to start this service manually later"
        return 1
    fi
}

# Verify service health
verify_service_health() {
    local service_name="$1"
    local port="${2:-}"

    if systemctl is-active --quiet "$service_name"; then
        log "SUCCESS" "Service $service_name is running"

        # Check port if provided
        if [ -n "$port" ]; then
            if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
                log "SUCCESS" "Service $service_name is listening on port $port"
            else
                log "WARN" "Service $service_name is running but not listening on port $port"
            fi
        fi
        return 0
    else
        log "ERROR" "Service $service_name is not running"
        return 1
    fi
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
            log "INFO" "Updating package lists..."
            if ! apt update >/dev/null 2>&1; then
                log "ERROR" "Failed to update package lists"
                exit 1
            fi

            # Install essential packages with error handling
            log "INFO" "Installing essential packages..."
            local essential_packages=(
                "curl" "wget" "git" "unzip" "software-properties-common"
                "apt-transport-https" "ca-certificates" "gnupg" "lsb-release"
                "jq" "openssl" "ufw"
            )

            for package in "${essential_packages[@]}"; do
                install_package_with_retry "$package" "$PACKAGE_MANAGER" true
            done

            # Install Node.js 18.x
            log "INFO" "Installing Node.js 18.x..."
            if add_repository_safely "Node.js Repository" "curl -fsSL https://deb.nodesource.com/setup_18.x | bash" true; then
                install_package_with_retry "nodejs" "$PACKAGE_MANAGER" true
            fi

            # Install PostgreSQL 16 (latest stable, avoids upgrade dialogs)
            log "INFO" "Installing PostgreSQL 16..."
            if add_repository_safely "PostgreSQL Repository" "wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && echo 'deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main' > /etc/apt/sources.list.d/pgdg.list && apt update" true; then
                install_package_with_retry "postgresql-16" "$PACKAGE_MANAGER" true
                install_package_with_retry "postgresql-client-16" "$PACKAGE_MANAGER" true
            fi

            # Install Kea DHCP with enhanced error handling
            log "INFO" "Installing Kea DHCP..."
            install_kea_packages

            # Install BIND9
            log "INFO" "Installing BIND9..."
            install_package_with_retry "bind9" "$PACKAGE_MANAGER" false
            install_package_with_retry "bind9utils" "$PACKAGE_MANAGER" false
            install_package_with_retry "bind9-dnsutils" "$PACKAGE_MANAGER" false

            # Install Nginx
            log "INFO" "Installing Nginx..."
            install_package_with_retry "nginx" "$PACKAGE_MANAGER" false
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
            
            # Install PostgreSQL 16 (latest stable)
            yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
            yum install -y postgresql16-server postgresql16
            
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
        /usr/pgsql-16/bin/postgresql-16-setup initdb
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

# Function to start and enable services
start_services() {
    log "INFO" "Starting and enabling services..."

    # Enable and start PostgreSQL (critical)
    log "INFO" "Starting PostgreSQL database..."
    systemctl enable postgresql >/dev/null 2>&1
    start_service_with_retry "postgresql" true

    # Enable and start Kea DHCP services (non-critical)
    log "INFO" "Starting Kea DHCP services..."

    # Try different service names for Kea
    local kea_dhcp_services=("isc-kea-dhcp4-server" "kea-dhcp4-server")
    local kea_ca_services=("isc-kea-ctrl-agent" "kea-ctrl-agent")

    for service in "${kea_dhcp_services[@]}"; do
        if systemctl list-unit-files | grep -q "$service.service"; then
            systemctl enable "$service" >/dev/null 2>&1 || true
            start_service_with_retry "$service" false
            break
        fi
    done

    for service in "${kea_ca_services[@]}"; do
        if systemctl list-unit-files | grep -q "$service.service"; then
            systemctl enable "$service" >/dev/null 2>&1 || true
            start_service_with_retry "$service" false
            break
        fi
    done

    # Enable and start BIND9 DNS (non-critical)
    log "INFO" "Starting BIND9 DNS service..."
    if systemctl list-unit-files | grep -q "bind9.service"; then
        systemctl enable bind9 >/dev/null 2>&1 || true
        start_service_with_retry "bind9" false
    elif systemctl list-unit-files | grep -q "named.service"; then
        systemctl enable named >/dev/null 2>&1 || true
        start_service_with_retry "named" false
    else
        log "WARN" "No BIND9 service found"
    fi

    # Enable and start SagaOS API Gateway (critical)
    log "INFO" "Starting SagaOS API Gateway..."
    systemctl enable sagaos-api >/dev/null 2>&1 || true
    start_service_with_retry "sagaos-api" true

    # Enable and start Nginx (non-critical)
    log "INFO" "Starting Nginx web server..."
    systemctl enable nginx >/dev/null 2>&1 || true
    start_service_with_retry "nginx" false

    log "SUCCESS" "Service startup completed"
}

# Function to verify service status
verify_services() {
    log "INFO" "Verifying service status..."
    echo ""
    echo "🔍 SERVICE STATUS REPORT:"
    echo "========================="

    # Check PostgreSQL
    if systemctl is-active --quiet postgresql; then
        echo "✅ PostgreSQL: RUNNING"
    else
        echo "❌ PostgreSQL: STOPPED"
    fi

    # Check Kea DHCP (try different service names)
    local kea_dhcp_running=false
    for service in "isc-kea-dhcp4-server" "kea-dhcp4-server"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            echo "✅ Kea DHCP4 ($service): RUNNING"
            kea_dhcp_running=true
            break
        fi
    done
    if [ "$kea_dhcp_running" = false ]; then
        echo "❌ Kea DHCP4: STOPPED"
    fi

    # Check Kea Control Agent (try different service names)
    local kea_ca_running=false
    for service in "isc-kea-ctrl-agent" "kea-ctrl-agent"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            echo "✅ Kea Control Agent ($service): RUNNING"
            kea_ca_running=true
            break
        fi
    done
    if [ "$kea_ca_running" = false ]; then
        echo "❌ Kea Control Agent: STOPPED"
    fi

    # Check BIND9/Named
    if systemctl is-active --quiet bind9; then
        echo "✅ BIND9 DNS: RUNNING"
    elif systemctl is-active --quiet named; then
        echo "✅ Named DNS: RUNNING"
    else
        echo "❌ DNS Service: STOPPED"
    fi

    # Check SagaOS API
    if systemctl is-active --quiet sagaos-api; then
        echo "✅ SagaOS API Gateway: RUNNING"
    else
        echo "❌ SagaOS API Gateway: STOPPED"
    fi

    # Check Nginx
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx Web Server: RUNNING"
    else
        echo "❌ Nginx Web Server: STOPPED"
    fi

    echo ""
    log "INFO" "Service verification complete"
}

# Enhanced installation summary with error reporting
display_installation_summary() {
    echo ""
    echo "🎯 INSTALLATION SUMMARY"
    echo "======================="
    echo ""

    # Error summary
    if [ $CRITICAL_ERRORS -gt 0 ]; then
        echo "🚨 CRITICAL ERRORS: $CRITICAL_ERRORS"
        echo "❌ Installation failed due to critical errors"
        echo ""
        echo "🔧 TROUBLESHOOTING:"
        echo "   - Check the installation log: $LOG_FILE"
        echo "   - Ensure you have root privileges"
        echo "   - Verify internet connectivity"
        echo "   - Check system requirements"
        echo ""
        return 1
    elif [ $INSTALLATION_ERRORS -gt 0 ]; then
        echo "⚠️  WARNINGS: $WARNING_COUNT"
        echo "❌ ERRORS: $INSTALLATION_ERRORS (non-critical)"
        echo "✅ Installation completed with some issues"
        echo ""
        echo "🔧 RECOMMENDATIONS:"
        echo "   - Review the installation log: $LOG_FILE"
        echo "   - Some features may not work properly"
        echo "   - Consider manual installation of failed components"
        echo ""
    else
        echo "✅ PERFECT INSTALLATION!"
        echo "🎉 No errors or warnings detected"
        echo ""
    fi

    # Access information
    echo "🌐 ACCESS INFORMATION:"
    echo "   📱 Frontend: http://localhost:5173"
    echo "   🔌 API Gateway: http://localhost:3001"
    echo "   🗄️  Database: localhost:5432 (user: admin, db: kea)"
    echo "   🌐 Kea Control: http://localhost:8000"
    echo ""

    # Service management
    echo "🔧 SERVICE MANAGEMENT:"
    echo "   📊 Check status: sudo ./scripts/check-services.sh"
    echo "   🔄 Restart all: sudo systemctl restart sagaos-*"
    echo "   📋 View logs: sudo journalctl -u sagaos-api -f"
    echo ""

    # Next steps
    echo "🚀 NEXT STEPS:"
    echo "   1. 🔍 Verify all services: sudo ./scripts/check-services.sh"
    echo "   2. 🌐 Open http://localhost:5173 in your browser"
    echo "   3. 🔑 Login with admin/admin (change password immediately)"
    echo "   4. 📖 Read documentation: ./README.md"
    echo ""

    if [ $INSTALLATION_ERRORS -eq 0 ]; then
        echo "🎊 CONGRATULATIONS! SagaOS is ready to use!"
    else
        echo "⚠️  Installation completed but please review any errors above"
    fi
    echo ""
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
    echo -e "  🌐 Frontend: ${YELLOW}http://$(hostname -I | awk '{print $1}'):5173${NC}"
    echo -e "  🔧 API Gateway: ${YELLOW}http://$(hostname -I | awk '{print $1}'):3001${NC}"
    echo -e "  📊 Health Check: ${YELLOW}http://$(hostname -I | awk '{print $1}'):3001/api/health${NC}"
    echo -e "  🔐 Login Credentials: ${YELLOW}admin/admin${NC}"
    echo ""
    echo -e "${CYAN}🔧 Service Status:${NC}"
    if systemctl is-active --quiet postgresql; then
        echo -e "  ✅ PostgreSQL Database: ${GREEN}RUNNING${NC}"
    else
        echo -e "  ❌ PostgreSQL Database: ${RED}STOPPED${NC}"
    fi
    if systemctl is-active --quiet sagaos-api; then
        echo -e "  ✅ SagaOS API Gateway: ${GREEN}RUNNING${NC}"
    else
        echo -e "  ❌ SagaOS API Gateway: ${RED}STOPPED${NC}"
    fi
    if systemctl is-active --quiet isc-kea-dhcp4-server; then
        echo -e "  ✅ Kea DHCP Server: ${GREEN}RUNNING${NC}"
    else
        echo -e "  ❌ Kea DHCP Server: ${RED}STOPPED${NC}"
    fi
    if systemctl is-active --quiet bind9 || systemctl is-active --quiet named; then
        echo -e "  ✅ DNS Server: ${GREEN}RUNNING${NC}"
    else
        echo -e "  ❌ DNS Server: ${RED}STOPPED${NC}"
    fi
    if systemctl is-active --quiet nginx; then
        echo -e "  ✅ Nginx Web Server: ${GREEN}RUNNING${NC}"
    else
        echo -e "  ❌ Nginx Web Server: ${RED}STOPPED${NC}"
    fi
    echo ""
    echo -e "${CYAN}🚀 Quick Start:${NC}"
    echo -e "  1. Frontend: ${YELLOW}http://$(hostname -I | awk '{print $1}'):5173${NC}"
    echo -e "  2. API Health: ${YELLOW}curl http://$(hostname -I | awk '{print $1}'):3001/api/health${NC}"
    echo -e "  3. Login with: ${YELLOW}admin/admin${NC}"
    echo -e "  4. ${RED}IMPORTANT: Change default passwords for production!${NC}"
    echo ""
    echo -e "${CYAN}🛠️  Service Management:${NC}"
    echo -e "  📊 Check Status: ${YELLOW}sudo systemctl status sagaos-api${NC}"
    echo -e "  🔄 Restart Services: ${YELLOW}sudo systemctl restart sagaos-api${NC}"
    echo -e "  📋 View Logs: ${YELLOW}sudo journalctl -u sagaos-api -f${NC}"
    echo -e "  🔧 Stop Services: ${YELLOW}sudo systemctl stop sagaos-api${NC}"
    echo -e "  ▶️  Start Services: ${YELLOW}sudo systemctl start sagaos-api${NC}"
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
    verify_services
    run_tests

    # Post-installation
    display_installation_summary

    if [ $CRITICAL_ERRORS -eq 0 ]; then
        log "SUCCESS" "Installation completed!"
        exit 0
    else
        log "ERROR" "Installation failed due to critical errors"
        exit 1
    fi
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main installation
main "$@"
