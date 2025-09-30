#!/bin/bash

# ============================================================================
# SagaOS Kea Pilot - Native Installation Script
# ============================================================================
# VM/Bare Metal deployment with system services
# Supports Ubuntu 20.04+, CentOS 8+, RHEL 8+
# 
# Usage: sudo ./install/install-native.sh
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_VERSION="1.0.0"
SCRIPT_NAME="SagaOS Native Installer"
LOG_FILE="/var/log/sagaos-native-install.log"
INSTALL_DIR="/opt/sagaos"
SERVICE_USER="sagaos"
WEB_USER="www-data"
DB_NAME="kea"
DB_USER="admin"
DB_PASSWORD="admin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation options
INSTALL_POSTGRESQL=true
INSTALL_KEA=true
INSTALL_BIND9=true
INSTALL_NGINX=true
SKIP_FIREWALL=false
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
    Native Installation System
EOF
echo -e "${NC}"

echo -e "${GREEN}🖥️  $SCRIPT_NAME v$SCRIPT_VERSION${NC}"
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

Install SagaOS Kea Pilot natively on VM or bare metal.

OPTIONS:
    -h, --help              Show this help message
    --skip-postgresql       Skip PostgreSQL installation
    --skip-kea              Skip Kea DHCP installation
    --skip-bind9            Skip BIND9 DNS installation
    --skip-nginx            Skip Nginx installation
    --skip-firewall         Skip firewall configuration
    --dry-run               Show what would be installed without doing it
    -f, --force             Force installation even if components exist
    -v, --verbose           Enable verbose logging

FEATURES:
    🗄️  PostgreSQL 15 database server
    🏠 Kea DHCP 2.4+ server with Control Agent
    🌐 BIND9 DNS server with DDNS support
    🔧 Nginx reverse proxy and web server
    👤 System user and service management
    🔥 Firewall configuration
    📊 Logging and monitoring setup
    🔐 Security hardening

EXAMPLES:
    $0                      # Full native installation
    $0 --skip-bind9         # Install without DNS server
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
            WEB_USER="www-data"
            ;;
        centos|rhel)
            if [[ "$OS_VERSION" < "8" ]]; then
                log "ERROR" "CentOS/RHEL 8 or later is required"
                exit 1
            fi
            PACKAGE_MANAGER="yum"
            WEB_USER="nginx"
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
        log "WARN" "Less than 4GB RAM detected ($mem_gb GB). Performance may be affected."
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
install_system_dependencies() {
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
                ufw \
                htop \
                vim \
                rsync \
                logrotate
            
            # Install Node.js 18.x
            curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
            apt install -y nodejs
            
            # Install build tools
            apt install -y build-essential
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
                jq \
                htop \
                vim \
                rsync \
                logrotate
            
            # Install Node.js 18.x
            curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
            yum install -y nodejs
            
            # Install development tools
            yum groupinstall -y "Development Tools"
            ;;
    esac
    
    log "INFO" "System dependencies installed successfully"
}

# Function to install PostgreSQL
install_postgresql() {
    if [ "$INSTALL_POSTGRESQL" = false ]; then
        log "INFO" "Skipping PostgreSQL installation"
        return
    fi
    
    log "INFO" "Installing PostgreSQL 15..."
    
    case "$PACKAGE_MANAGER" in
        apt)
            # Add PostgreSQL official repository
            wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
            echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
            apt update
            
            # Install PostgreSQL
            apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15
            ;;
        yum)
            # Add PostgreSQL official repository
            yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
            
            # Install PostgreSQL
            yum install -y postgresql15-server postgresql15 postgresql15-contrib
            
            # Initialize database
            /usr/pgsql-15/bin/postgresql-15-setup initdb
            ;;
    esac
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Configure PostgreSQL
    log "INFO" "Configuring PostgreSQL..."
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF
    
    # Configure authentication
    local pg_version="15"
    local pg_config_dir="/etc/postgresql/$pg_version/main"
    
    if [ "$PACKAGE_MANAGER" = "yum" ]; then
        pg_config_dir="/var/lib/pgsql/$pg_version/data"
    fi
    
    # Update pg_hba.conf for local connections
    if [ -f "$pg_config_dir/pg_hba.conf" ]; then
        sed -i "s/local   all             all                                     peer/local   all             all                                     md5/" "$pg_config_dir/pg_hba.conf"
        systemctl restart postgresql
    fi
    
    log "INFO" "PostgreSQL installed and configured"
}

# Function to install Kea DHCP
install_kea() {
    if [ "$INSTALL_KEA" = false ]; then
        log "INFO" "Skipping Kea DHCP installation"
        return
    fi
    
    log "INFO" "Installing Kea DHCP server..."
    
    case "$PACKAGE_MANAGER" in
        apt)
            # Install Kea from official repository
            apt install -y isc-kea-dhcp4-server isc-kea-ctrl-agent isc-kea-admin isc-kea-common
            ;;
        yum)
            # For CentOS/RHEL, we need to build from source or use third-party repo
            log "WARN" "Kea DHCP installation on CentOS/RHEL requires manual setup"
            log "INFO" "Please refer to: https://kea.readthedocs.io/en/latest/arm/install.html"
            return
            ;;
    esac
    
    # Create Kea directories
    mkdir -p /etc/kea /var/lib/kea /var/log/kea
    chown -R root:root /etc/kea
    chown -R _kea:_kea /var/lib/kea /var/log/kea || true
    
    # Enable but don't start yet (will be configured later)
    systemctl enable isc-kea-dhcp4-server
    systemctl enable isc-kea-ctrl-agent
    
    log "INFO" "Kea DHCP server installed"
}

# Function to install BIND9
install_bind9() {
    if [ "$INSTALL_BIND9" = false ]; then
        log "INFO" "Skipping BIND9 installation"
        return
    fi
    
    log "INFO" "Installing BIND9 DNS server..."
    
    case "$PACKAGE_MANAGER" in
        apt)
            apt install -y bind9 bind9utils bind9-dnsutils bind9-doc
            ;;
        yum)
            yum install -y bind bind-utils bind-chroot
            ;;
    esac
    
    # Create BIND9 directories
    mkdir -p /etc/bind/keys /var/lib/bind /var/log/bind
    chown -R bind:bind /etc/bind /var/lib/bind /var/log/bind
    
    # Enable but don't start yet (will be configured later)
    if [ "$PACKAGE_MANAGER" = "apt" ]; then
        systemctl enable bind9
    else
        systemctl enable named
    fi
    
    log "INFO" "BIND9 DNS server installed"
}

# Function to install Nginx
install_nginx() {
    if [ "$INSTALL_NGINX" = false ]; then
        log "INFO" "Skipping Nginx installation"
        return
    fi
    
    log "INFO" "Installing Nginx web server..."
    
    case "$PACKAGE_MANAGER" in
        apt)
            apt install -y nginx
            ;;
        yum)
            yum install -y nginx
            ;;
    esac
    
    # Create web directories
    mkdir -p /var/www/sagaos /var/log/nginx
    chown -R "$WEB_USER:$WEB_USER" /var/www/sagaos
    
    # Enable but don't start yet (will be configured later)
    systemctl enable nginx
    
    log "INFO" "Nginx web server installed"
}

# Function to create system users
create_system_users() {
    log "INFO" "Creating system users..."
    
    # Create SagaOS service user
    if ! id "$SERVICE_USER" >/dev/null 2>&1; then
        useradd --system --home-dir "$INSTALL_DIR" --shell /bin/bash --create-home "$SERVICE_USER"
        log "INFO" "Created system user: $SERVICE_USER"
    else
        log "INFO" "System user already exists: $SERVICE_USER"
    fi
    
    # Add service user to necessary groups
    usermod -a -G adm "$SERVICE_USER" || true
    
    log "INFO" "System users configured"
}

# Function to setup installation directory
setup_installation_directory() {
    log "INFO" "Setting up installation directory..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"/{backend,config,logs,data}
    
    # Set ownership and permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chmod 755 "$INSTALL_DIR"
    chmod 750 "$INSTALL_DIR"/{config,logs,data}
    
    log "INFO" "Installation directory ready: $INSTALL_DIR"
}

# Function to install SagaOS application
install_sagaos_application() {
    log "INFO" "Installing SagaOS application..."
    
    # Copy application files (assuming we're running from the source directory)
    if [ -f "package.json" ]; then
        # Copy all application files
        rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' . "$INSTALL_DIR/"
        
        # Set ownership
        chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
        
        # Install Node.js dependencies
        cd "$INSTALL_DIR"
        sudo -u "$SERVICE_USER" npm install --production
        
        # Build frontend
        sudo -u "$SERVICE_USER" npm run build
        
        log "INFO" "SagaOS application installed"
    else
        log "ERROR" "package.json not found. Please run from SagaOS source directory."
        exit 1
    fi
}

# Function to configure database schemas
configure_database_schemas() {
    log "INFO" "Configuring database schemas..."
    
    # Apply database schemas
    if [ -f "$INSTALL_DIR/config/database/users-schema.sql" ]; then
        sudo -u postgres psql -d "$DB_NAME" -f "$INSTALL_DIR/config/database/users-schema.sql"
        log "INFO" "Users schema applied"
    fi
    
    if [ -f "$INSTALL_DIR/config/database/dns-schema.sql" ]; then
        sudo -u postgres psql -d "$DB_NAME" -f "$INSTALL_DIR/config/database/dns-schema.sql"
        log "INFO" "DNS schema applied"
    fi
    
    log "INFO" "Database schemas configured"
}

# Function to configure services
configure_services() {
    log "INFO" "Configuring services..."
    
    cd "$INSTALL_DIR"
    
    # Setup authentication
    if [ -f "install/setup-authentication.sh" ]; then
        sudo -u "$SERVICE_USER" bash install/setup-authentication.sh
        log "INFO" "Authentication configured"
    fi
    
    # Generate service configurations
    if [ -f "install/template-generator.sh" ]; then
        sudo -u "$SERVICE_USER" bash install/template-generator.sh generate --env development
        log "INFO" "Service configurations generated"
    fi
    
    # Copy configurations to system locations
    if [ -d "rendered/kea" ]; then
        cp rendered/kea/*.conf /etc/kea/
        chown root:root /etc/kea/*.conf
        log "INFO" "Kea configurations installed"
    fi
    
    if [ -d "rendered/bind9" ]; then
        cp rendered/bind9/* /etc/bind/
        chown bind:bind /etc/bind/*
        log "INFO" "BIND9 configurations installed"
    fi
    
    log "INFO" "Services configured"
}

# Function to create systemd services
create_systemd_services() {
    log "INFO" "Creating systemd services..."
    
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
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    # Create SagaOS frontend service (if needed)
    cat > /etc/systemd/system/sagaos-frontend.service << EOF
[Unit]
Description=SagaOS Frontend Server
After=network.target sagaos-api.service
Wants=sagaos-api.service

[Service]
Type=forking
User=$WEB_USER
Group=$WEB_USER
ExecStart=/usr/sbin/nginx
ExecReload=/bin/kill -s HUP \$MAINPID
ExecStop=/bin/kill -s QUIT \$MAINPID
PIDFile=/var/run/nginx.pid

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable services
    systemctl daemon-reload
    systemctl enable sagaos-api
    systemctl enable sagaos-frontend
    
    log "INFO" "Systemd services created"
}

# Function to configure firewall
configure_firewall() {
    if [ "$SKIP_FIREWALL" = true ]; then
        log "INFO" "Skipping firewall configuration"
        return
    fi
    
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
            ufw allow 3001/tcp  # API Gateway
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
            firewall-cmd --permanent --add-port=3001/tcp
            firewall-cmd --reload
            ;;
    esac
    
    log "INFO" "Firewall configured"
}

# Function to configure log rotation
configure_logging() {
    log "INFO" "Configuring logging and log rotation..."
    
    # Create log directories
    mkdir -p /var/log/sagaos
    chown "$SERVICE_USER:$SERVICE_USER" /var/log/sagaos
    
    # Create logrotate configuration
    cat > /etc/logrotate.d/sagaos << EOF
/var/log/sagaos/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_USER
    postrotate
        systemctl reload sagaos-api || true
    endscript
}
EOF
    
    log "INFO" "Logging configured"
}

# Function to start all services
start_services() {
    log "INFO" "Starting services..."
    
    # Start database
    systemctl start postgresql
    
    # Start Kea services
    if [ "$INSTALL_KEA" = true ]; then
        systemctl start isc-kea-dhcp4-server || log "WARN" "Kea DHCP4 failed to start"
        systemctl start isc-kea-ctrl-agent || log "WARN" "Kea Control Agent failed to start"
    fi
    
    # Start BIND9
    if [ "$INSTALL_BIND9" = true ]; then
        systemctl start bind9 || systemctl start named || log "WARN" "BIND9 failed to start"
    fi
    
    # Start SagaOS services
    systemctl start sagaos-api
    
    # Start Nginx
    if [ "$INSTALL_NGINX" = true ]; then
        systemctl start nginx
    fi
    
    log "INFO" "Services started"
}

# Function to run post-installation tests
run_tests() {
    log "INFO" "Running post-installation tests..."
    
    # Test database connection
    if sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        log "INFO" "Database connection: OK"
    else
        log "ERROR" "Database connection: FAILED"
    fi
    
    # Test SagaOS API
    sleep 10
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        log "INFO" "SagaOS API: OK"
    else
        log "WARN" "SagaOS API: Not responding"
    fi
    
    # Test Nginx
    if [ "$INSTALL_NGINX" = true ]; then
        if curl -s http://localhost >/dev/null 2>&1; then
            log "INFO" "Nginx: OK"
        else
            log "WARN" "Nginx: Not responding"
        fi
    fi
    
    log "INFO" "Post-installation tests completed"
}

# Function to display installation summary
display_summary() {
    echo ""
    echo -e "${GREEN}🎉 SagaOS Native Installation Complete!${NC}"
    echo -e "${BLUE}=======================================${NC}"
    echo ""
    echo -e "${CYAN}📋 Installed Components:${NC}"
    [ "$INSTALL_POSTGRESQL" = true ] && echo -e "  🗄️  PostgreSQL: ${GREEN}$(sudo -u postgres psql --version | head -1)${NC}"
    [ "$INSTALL_KEA" = true ] && echo -e "  🏠 Kea DHCP: ${GREEN}Installed${NC}"
    [ "$INSTALL_BIND9" = true ] && echo -e "  🌐 BIND9 DNS: ${GREEN}Installed${NC}"
    [ "$INSTALL_NGINX" = true ] && echo -e "  🔧 Nginx: ${GREEN}$(nginx -v 2>&1)${NC}"
    echo -e "  📱 SagaOS API: ${GREEN}Installed${NC}"
    echo ""
    echo -e "${CYAN}🌐 Access Information:${NC}"
    echo -e "  📱 Web Interface: ${YELLOW}http://$(hostname -I | awk '{print $1}')${NC}"
    echo -e "  🔐 Login Credentials: ${YELLOW}admin/admin${NC}"
    echo -e "  🗄️  Database: ${YELLOW}localhost:5432 (admin/admin)${NC}"
    echo -e "  🏠 Kea Control Agent: ${YELLOW}http://localhost:8000${NC}"
    echo ""
    echo -e "${CYAN}🛠️  Management Commands:${NC}"
    echo -e "  📊 View API logs: ${YELLOW}journalctl -u sagaos-api -f${NC}"
    echo -e "  🔄 Restart API: ${YELLOW}systemctl restart sagaos-api${NC}"
    echo -e "  📋 Service status: ${YELLOW}systemctl status sagaos-*${NC}"
    echo -e "  🗄️  Database access: ${YELLOW}sudo -u postgres psql -d kea${NC}"
    echo ""
    echo -e "${CYAN}📁 Important Directories:${NC}"
    echo -e "  📂 Installation: ${YELLOW}$INSTALL_DIR${NC}"
    echo -e "  📋 Logs: ${YELLOW}/var/log/sagaos/${NC}"
    echo -e "  ⚙️  Configs: ${YELLOW}/etc/kea/, /etc/bind/${NC}"
    echo ""
    echo -e "${CYAN}📚 Documentation:${NC}"
    echo -e "  📖 User Guide: ${YELLOW}$INSTALL_DIR/docs/USER_GUIDE.md${NC}"
    echo -e "  🔐 Security Guide: ${YELLOW}$INSTALL_DIR/docs/PRODUCTION_SECURITY_GUIDE.md${NC}"
    echo -e "  🛠️  Admin Guide: ${YELLOW}$INSTALL_DIR/docs/ADMIN_GUIDE.md${NC}"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Change default passwords for production!${NC}"
    echo ""
    echo -e "${GREEN}Thank you for choosing SagaOS! 🖥️${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        --skip-postgresql)
            INSTALL_POSTGRESQL=false
            shift
            ;;
        --skip-kea)
            INSTALL_KEA=false
            shift
            ;;
        --skip-bind9)
            INSTALL_BIND9=false
            shift
            ;;
        --skip-nginx)
            INSTALL_NGINX=false
            shift
            ;;
        --skip-firewall)
            SKIP_FIREWALL=true
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
    log "INFO" "Starting SagaOS native installation..."
    
    if [ "$DRY_RUN" = true ]; then
        log "INFO" "DRY RUN MODE - No changes will be made"
        log "INFO" "Would install PostgreSQL: $INSTALL_POSTGRESQL"
        log "INFO" "Would install Kea DHCP: $INSTALL_KEA"
        log "INFO" "Would install BIND9: $INSTALL_BIND9"
        log "INFO" "Would install Nginx: $INSTALL_NGINX"
        log "INFO" "Would install to: $INSTALL_DIR"
        exit 0
    fi
    
    # Pre-installation checks
    detect_os
    check_requirements
    
    # Installation steps
    install_system_dependencies
    install_postgresql
    install_kea
    install_bind9
    install_nginx
    create_system_users
    setup_installation_directory
    install_sagaos_application
    configure_database_schemas
    configure_services
    create_systemd_services
    configure_firewall
    configure_logging
    start_services
    run_tests
    
    # Post-installation
    display_summary
    
    log "INFO" "Native installation completed successfully!"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main installation
main "$@"
