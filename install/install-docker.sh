#!/bin/bash

# ============================================================================
# SagaOS Kea Pilot - Docker Installation Script
# ============================================================================
# Containerized deployment with Docker and Docker Compose
# Supports Ubuntu 20.04+, CentOS 8+, RHEL 8+
# 
# Usage: sudo ./install/install-docker.sh
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_VERSION="1.0.0"
SCRIPT_NAME="SagaOS Docker Installer"
LOG_FILE="/var/log/sagaos-docker-install.log"
COMPOSE_VERSION="2.21.0"
DOCKER_COMPOSE_URL="https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation options
SKIP_DOCKER_INSTALL=false
SKIP_COMPOSE_INSTALL=false
SKIP_BUILD=false
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
    Docker Installation System
EOF
echo -e "${NC}"

echo -e "${GREEN}🐳 $SCRIPT_NAME v$SCRIPT_VERSION${NC}"
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

Install SagaOS Kea Pilot using Docker containers.

OPTIONS:
    -h, --help              Show this help message
    --skip-docker           Skip Docker installation (if already installed)
    --skip-compose          Skip Docker Compose installation
    --skip-build            Skip building containers
    --dry-run               Show what would be installed without doing it
    -f, --force             Force installation even if Docker exists
    -v, --verbose           Enable verbose logging

FEATURES:
    🐳 Docker Engine installation
    🔧 Docker Compose installation
    📦 Container image building
    🌐 Network configuration
    💾 Volume management
    🔐 Security configuration
    🚀 Service orchestration

EXAMPLES:
    $0                      # Full Docker installation
    $0 --skip-docker        # Skip Docker, install Compose only
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
        log "WARN" "Less than 4GB RAM detected ($mem_gb GB). Docker may be slow."
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

# Function to install Docker
install_docker() {
    if [ "$SKIP_DOCKER_INSTALL" = true ]; then
        log "INFO" "Skipping Docker installation"
        return
    fi
    
    # Check if Docker is already installed
    if command -v docker >/dev/null 2>&1 && [ "$FORCE" = false ]; then
        log "INFO" "Docker is already installed: $(docker --version)"
        return
    fi
    
    log "INFO" "Installing Docker Engine..."
    
    case "$PACKAGE_MANAGER" in
        apt)
            # Remove old versions
            apt remove -y docker docker-engine docker.io containerd runc || true
            
            # Update package index
            apt update
            
            # Install prerequisites
            apt install -y \
                ca-certificates \
                curl \
                gnupg \
                lsb-release
            
            # Add Docker's official GPG key
            mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            
            # Set up the repository
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # Update package index
            apt update
            
            # Install Docker Engine
            apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
            ;;
        yum)
            # Remove old versions
            yum remove -y docker \
                docker-client \
                docker-client-latest \
                docker-common \
                docker-latest \
                docker-latest-logrotate \
                docker-logrotate \
                docker-engine || true
            
            # Install prerequisites
            yum install -y yum-utils
            
            # Set up the repository
            yum-config-manager \
                --add-repo \
                https://download.docker.com/linux/centos/docker-ce.repo
            
            # Install Docker Engine
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
            ;;
    esac
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Add current user to docker group (if not root)
    if [ "$SUDO_USER" ]; then
        usermod -aG docker "$SUDO_USER"
        log "INFO" "Added $SUDO_USER to docker group"
    fi
    
    # Verify Docker installation
    if docker --version >/dev/null 2>&1; then
        log "INFO" "Docker installed successfully: $(docker --version)"
    else
        log "ERROR" "Docker installation failed"
        exit 1
    fi
}

# Function to install Docker Compose
install_docker_compose() {
    if [ "$SKIP_COMPOSE_INSTALL" = true ]; then
        log "INFO" "Skipping Docker Compose installation"
        return
    fi
    
    # Check if Docker Compose is already installed
    if command -v docker-compose >/dev/null 2>&1 && [ "$FORCE" = false ]; then
        log "INFO" "Docker Compose is already installed: $(docker-compose --version)"
        return
    fi
    
    log "INFO" "Installing Docker Compose v$COMPOSE_VERSION..."
    
    # Download Docker Compose
    curl -L "$DOCKER_COMPOSE_URL" -o /usr/local/bin/docker-compose
    
    # Make it executable
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink for compatibility
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    # Verify installation
    if docker-compose --version >/dev/null 2>&1; then
        log "INFO" "Docker Compose installed successfully: $(docker-compose --version)"
    else
        log "ERROR" "Docker Compose installation failed"
        exit 1
    fi
}

# Function to create Docker Compose configuration
create_docker_compose() {
    log "INFO" "Creating Docker Compose configuration..."
    
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: sagaos-postgres
    environment:
      POSTGRES_DB: kea
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin
      POSTGRES_INITDB_ARGS: "--auth-host=md5"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/database:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - sagaos-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d kea"]
      interval: 30s
      timeout: 10s
      retries: 3

  # SagaOS Backend API
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: sagaos-backend
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=kea
      - DB_USER=admin
      - DB_PASSWORD=admin
      - KEA_CA_URL=http://kea-ca:8000
      - KEA_CA_USER=admin
      - KEA_CA_PASSWORD=admin
      - DNS_SERVER=bind9
      - PORT=3001
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - sagaos-network
    restart: unless-stopped
    volumes:
      - ./logs:/var/log/sagaos

  # SagaOS Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sagaos-frontend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - sagaos-network
    restart: unless-stopped
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro

  # Kea DHCP Server
  kea-dhcp4:
    image: jonasal/kea-dhcp4:2.4.1
    container_name: sagaos-kea-dhcp4
    environment:
      - KEA_DHCP4_CONFIG_FILE=/etc/kea/kea-dhcp4.conf
    volumes:
      - ./config/kea/kea-dhcp4.conf:/etc/kea/kea-dhcp4.conf:ro
      - kea_data:/var/lib/kea
    ports:
      - "67:67/udp"
    networks:
      - sagaos-network
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - NET_RAW

  # Kea Control Agent
  kea-ca:
    image: jonasal/kea-ctrl-agent:2.4.1
    container_name: sagaos-kea-ca
    environment:
      - KEA_CTRL_AGENT_CONFIG_FILE=/etc/kea/kea-ctrl-agent.conf
    volumes:
      - ./config/kea/kea-ctrl-agent.conf:/etc/kea/kea-ctrl-agent.conf:ro
      - kea_data:/var/lib/kea
    ports:
      - "8000:8000"
    networks:
      - sagaos-network
    restart: unless-stopped
    depends_on:
      - kea-dhcp4

  # BIND9 DNS Server
  bind9:
    image: internetsystemsconsortium/bind9:9.18
    container_name: sagaos-bind9
    environment:
      - BIND9_USER=bind
    volumes:
      - ./config/bind9:/etc/bind:ro
      - bind9_data:/var/lib/bind
      - bind9_logs:/var/log/bind
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "953:953/tcp"
    networks:
      - sagaos-network
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
  kea_data:
    driver: local
  bind9_data:
    driver: local
  bind9_logs:
    driver: local

networks:
  sagaos-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
EOF
    
    log "INFO" "Docker Compose configuration created"
}

# Function to build Docker images
build_images() {
    if [ "$SKIP_BUILD" = true ]; then
        log "INFO" "Skipping Docker image building"
        return
    fi
    
    log "INFO" "Building Docker images..."
    
    # Build frontend image
    if [ -f "Dockerfile" ]; then
        docker build -t sagaos/frontend:latest .
        log "INFO" "Frontend image built successfully"
    fi
    
    # Build backend image
    if [ -f "backend/Dockerfile" ]; then
        docker build -f backend/Dockerfile -t sagaos/backend:latest .
        log "INFO" "Backend image built successfully"
    fi
}

# Function to setup environment
setup_environment() {
    log "INFO" "Setting up Docker environment..."
    
    # Create necessary directories
    mkdir -p logs config/{kea,bind9,database}
    
    # Copy environment file
    if [ -f ".env.development" ]; then
        cp .env.development .env
        log "INFO" "Environment file configured"
    fi
    
    # Generate configurations
    if [ -f "install/template-generator.sh" ]; then
        bash install/template-generator.sh generate --env development
        log "INFO" "Service configurations generated"
    fi
    
    # Set permissions
    chmod -R 755 config/
    chmod 644 .env
    
    log "INFO" "Environment setup completed"
}

# Function to start services
start_services() {
    log "INFO" "Starting Docker services..."
    
    # Pull required images
    docker-compose pull
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    log "INFO" "Waiting for services to start..."
    sleep 30
    
    # Check service health
    if docker-compose ps | grep -q "Up"; then
        log "INFO" "Docker services started successfully"
    else
        log "ERROR" "Some services failed to start"
        docker-compose logs
        exit 1
    fi
}

# Function to run post-installation tests
run_tests() {
    log "INFO" "Running post-installation tests..."
    
    # Test database connection
    if docker-compose exec -T postgres pg_isready -U admin -d kea >/dev/null 2>&1; then
        log "INFO" "Database connection: OK"
    else
        log "ERROR" "Database connection: FAILED"
    fi
    
    # Test backend API
    sleep 10
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        log "INFO" "Backend API: OK"
    else
        log "WARN" "Backend API: Not responding"
    fi
    
    # Test frontend
    if curl -s http://localhost >/dev/null 2>&1; then
        log "INFO" "Frontend: OK"
    else
        log "WARN" "Frontend: Not responding"
    fi
    
    log "INFO" "Post-installation tests completed"
}

# Function to display installation summary
display_summary() {
    echo ""
    echo -e "${GREEN}🎉 SagaOS Docker Installation Complete!${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo ""
    echo -e "${CYAN}📋 Docker Services:${NC}"
    echo -e "  🐳 Docker Engine: ${GREEN}$(docker --version)${NC}"
    echo -e "  🔧 Docker Compose: ${GREEN}$(docker-compose --version)${NC}"
    echo ""
    echo -e "${CYAN}🚀 Running Services:${NC}"
    docker-compose ps
    echo ""
    echo -e "${CYAN}🌐 Access Information:${NC}"
    echo -e "  📱 Web Interface: ${YELLOW}http://$(hostname -I | awk '{print $1}')${NC}"
    echo -e "  🔐 Login Credentials: ${YELLOW}admin/admin${NC}"
    echo -e "  🗄️  Database: ${YELLOW}localhost:5432 (admin/admin)${NC}"
    echo -e "  🏠 Kea Control Agent: ${YELLOW}http://localhost:8000${NC}"
    echo ""
    echo -e "${CYAN}🛠️  Management Commands:${NC}"
    echo -e "  📊 View logs: ${YELLOW}docker-compose logs -f${NC}"
    echo -e "  🔄 Restart services: ${YELLOW}docker-compose restart${NC}"
    echo -e "  ⏹️  Stop services: ${YELLOW}docker-compose down${NC}"
    echo -e "  🔧 Update services: ${YELLOW}docker-compose pull && docker-compose up -d${NC}"
    echo ""
    echo -e "${CYAN}📚 Documentation:${NC}"
    echo -e "  📖 User Guide: ${YELLOW}docs/USER_GUIDE.md${NC}"
    echo -e "  🔐 Security Guide: ${YELLOW}docs/PRODUCTION_SECURITY_GUIDE.md${NC}"
    echo -e "  🐳 Docker Guide: ${YELLOW}docs/DOCKER_GUIDE.md${NC}"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Change default passwords for production!${NC}"
    echo ""
    echo -e "${GREEN}Thank you for choosing SagaOS! 🐳${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        --skip-docker)
            SKIP_DOCKER_INSTALL=true
            shift
            ;;
        --skip-compose)
            SKIP_COMPOSE_INSTALL=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
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
    log "INFO" "Starting SagaOS Docker installation..."
    
    if [ "$DRY_RUN" = true ]; then
        log "INFO" "DRY RUN MODE - No changes will be made"
        log "INFO" "Would install Docker Engine and Docker Compose"
        log "INFO" "Would create Docker Compose configuration"
        log "INFO" "Would build and start containers"
        exit 0
    fi
    
    # Pre-installation checks
    detect_os
    check_requirements
    
    # Installation steps
    install_docker
    install_docker_compose
    create_docker_compose
    setup_environment
    build_images
    start_services
    run_tests
    
    # Post-installation
    display_summary
    
    log "INFO" "Docker installation completed successfully!"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main installation
main "$@"
