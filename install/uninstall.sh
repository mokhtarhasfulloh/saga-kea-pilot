#!/bin/bash

# ============================================================================
# SagaOS Kea Pilot - Uninstall Script
# ============================================================================
# Complete removal of SagaOS installation
# Supports both native and Docker deployments
# 
# Usage: sudo ./install/uninstall.sh [OPTIONS]
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_VERSION="1.0.0"
SCRIPT_NAME="SagaOS Uninstaller"
LOG_FILE="/var/log/sagaos-uninstall.log"
BACKUP_DIR="/opt/sagaos/backups/uninstall-$(date +%Y%m%d-%H%M%S)"
INSTALL_DIR="/opt/sagaos"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Uninstall options
BACKUP_BEFORE_UNINSTALL=true
REMOVE_DATABASE=false
REMOVE_CONFIGURATIONS=true
REMOVE_LOGS=false
REMOVE_USERS=true
FORCE_REMOVAL=false
DRY_RUN=false
DOCKER_DEPLOYMENT=false

echo -e "${RED}"
cat << "EOF"
 ____                   ___  ____  
/ ___|  __ _  __ _  __ _/ _ \/ ___| 
\___ \ / _` |/ _` |/ _` | | | \___ \ 
 ___) | (_| | (_| | (_| | |_| |___) |
|____/ \__,_|\__, |\__,_|\___/|____/ 
             |___/                  
    Uninstall Management System
EOF
echo -e "${NC}"

echo -e "${RED}🗑️  $SCRIPT_NAME v$SCRIPT_VERSION${NC}"
echo -e "${BLUE}📅 $(date)${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will completely remove SagaOS from your system!${NC}"
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

Completely remove SagaOS Kea Pilot from the system.

OPTIONS:
    -h, --help              Show this help message
    --no-backup             Skip backup before uninstall
    --remove-database       Remove PostgreSQL database and data
    --keep-configurations   Keep configuration files
    --remove-logs           Remove all log files
    --keep-users            Keep system users
    --force                 Force removal without confirmation
    --dry-run               Show what would be removed without doing it
    --docker                Uninstall Docker deployment
    -v, --verbose           Enable verbose logging

UNINSTALL PROCESS:
    1. 🔍 Pre-uninstall validation
    2. 💾 Backup current installation (optional)
    3. ⏹️  Stop all services
    4. 🗑️  Remove application files
    5. 🗄️  Remove database (optional)
    6. ⚙️  Remove configurations
    7. 👤 Remove system users (optional)
    8. 🧹 Clean up remaining files
    9. 📋 Generate removal report

WHAT GETS REMOVED:
    🗂️  Application files (/opt/sagaos)
    🐳 Docker containers and images (if --docker)
    ⚙️  Configuration files (/etc/kea, /etc/bind)
    🔧 Systemd services
    👤 System users (sagaos)
    📋 Log files (optional)
    🗄️  Database (optional)

EXAMPLES:
    $0                      # Standard uninstall (keeps database)
    $0 --remove-database    # Remove everything including database
    $0 --docker             # Uninstall Docker deployment
    $0 --dry-run            # Preview what would be removed
    $0 --force              # Skip confirmation prompts

REQUIREMENTS:
    - Root privileges (sudo)
    - Existing SagaOS installation

EOF
}

# Function to confirm uninstall
confirm_uninstall() {
    if [ "$FORCE_REMOVAL" = true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  You are about to completely remove SagaOS from this system.${NC}"
    echo ""
    echo -e "${CYAN}What will be removed:${NC}"
    echo -e "  🗂️  Application files: ${YELLOW}/opt/sagaos${NC}"
    [ "$DOCKER_DEPLOYMENT" = true ] && echo -e "  🐳 Docker containers and images"
    [ "$REMOVE_CONFIGURATIONS" = true ] && echo -e "  ⚙️  Configuration files: ${YELLOW}/etc/kea, /etc/bind${NC}"
    [ "$REMOVE_USERS" = true ] && echo -e "  👤 System users: ${YELLOW}sagaos${NC}"
    [ "$REMOVE_DATABASE" = true ] && echo -e "  🗄️  Database: ${YELLOW}PostgreSQL kea database${NC}"
    [ "$REMOVE_LOGS" = true ] && echo -e "  📋 Log files: ${YELLOW}/var/log/sagaos${NC}"
    echo ""
    echo -e "${CYAN}What will be preserved:${NC}"
    [ "$BACKUP_BEFORE_UNINSTALL" = true ] && echo -e "  💾 Backup: ${GREEN}$BACKUP_DIR${NC}"
    [ "$REMOVE_DATABASE" = false ] && echo -e "  🗄️  Database: ${GREEN}PostgreSQL kea database${NC}"
    [ "$REMOVE_LOGS" = false ] && echo -e "  📋 Log files: ${GREEN}/var/log/sagaos${NC}"
    echo ""
    
    read -p "Are you sure you want to proceed? (type 'yes' to confirm): " confirmation
    if [ "$confirmation" != "yes" ]; then
        log "INFO" "Uninstall cancelled by user"
        exit 0
    fi
}

# Function to detect deployment type
detect_deployment() {
    log "INFO" "Detecting deployment type..."
    
    if command -v docker >/dev/null 2>&1 && docker ps | grep -q sagaos; then
        DOCKER_DEPLOYMENT=true
        log "INFO" "Docker deployment detected"
    elif [ -d "$INSTALL_DIR" ]; then
        DOCKER_DEPLOYMENT=false
        log "INFO" "Native deployment detected"
    else
        log "WARN" "No SagaOS installation found"
        return 1
    fi
}

# Function to create backup
create_backup() {
    if [ "$BACKUP_BEFORE_UNINSTALL" = false ]; then
        log "INFO" "Skipping backup (disabled by user)"
        return 0
    fi
    
    log "INFO" "Creating backup before uninstall..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    if [ "$DOCKER_DEPLOYMENT" = true ]; then
        # Docker backup
        log "INFO" "Backing up Docker deployment..."
        
        # Backup database
        if docker ps | grep -q sagaos-postgres; then
            docker exec sagaos-postgres-prod pg_dump -U admin kea > "$BACKUP_DIR/database.sql"
            log "INFO" "Database backup created"
        fi
        
        # Export Docker images
        docker save $(docker images --format "table {{.Repository}}:{{.Tag}}" | grep sagaos | tr '\n' ' ') > "$BACKUP_DIR/docker-images.tar" 2>/dev/null || true
        log "INFO" "Docker images backup created"
        
        # Backup docker-compose files
        cp docker-compose*.yml "$BACKUP_DIR/" 2>/dev/null || true
        
    else
        # Native backup
        log "INFO" "Backing up native installation..."
        
        # Backup application files
        if [ -d "$INSTALL_DIR" ]; then
            rsync -av "$INSTALL_DIR/" "$BACKUP_DIR/application/"
            log "INFO" "Application backup created"
        fi
        
        # Backup database
        if command -v pg_dump >/dev/null 2>&1; then
            sudo -u postgres pg_dump kea > "$BACKUP_DIR/database.sql" 2>/dev/null || true
            log "INFO" "Database backup created"
        fi
        
        # Backup configurations
        cp -r /etc/kea "$BACKUP_DIR/kea-config" 2>/dev/null || true
        cp -r /etc/bind "$BACKUP_DIR/bind-config" 2>/dev/null || true
        cp /etc/nginx/nginx.conf "$BACKUP_DIR/nginx.conf" 2>/dev/null || true
        log "INFO" "Configuration backup created"
    fi
    
    # Create backup manifest
    cat > "$BACKUP_DIR/manifest.json" << EOF
{
    "backup_date": "$(date -Iseconds)",
    "deployment_type": "$([ "$DOCKER_DEPLOYMENT" = true ] && echo "docker" || echo "native")",
    "hostname": "$(hostname)",
    "backup_reason": "uninstall",
    "backup_size": "$(du -sh "$BACKUP_DIR" | cut -f1)"
}
EOF
    
    log "INFO" "Backup completed: $BACKUP_DIR"
}

# Function to stop services
stop_services() {
    log "INFO" "Stopping SagaOS services..."
    
    if [ "$DOCKER_DEPLOYMENT" = true ]; then
        # Stop Docker containers
        if [ -f "docker-compose.yml" ]; then
            docker-compose down --timeout 30 2>/dev/null || true
        fi
        
        # Stop individual containers if compose fails
        local containers=$(docker ps --format "{{.Names}}" | grep sagaos || true)
        for container in $containers; do
            docker stop "$container" 2>/dev/null || true
            log "INFO" "Stopped container: $container"
        done
        
    else
        # Stop native services
        local services=("sagaos-api" "sagaos-frontend" "isc-kea-dhcp4-server" "isc-kea-ctrl-agent" "bind9" "nginx")
        for service in "${services[@]}"; do
            if systemctl is-active "$service" >/dev/null 2>&1; then
                systemctl stop "$service" 2>/dev/null || true
                log "INFO" "Stopped service: $service"
            fi
        done
    fi
}

# Function to remove Docker deployment
remove_docker_deployment() {
    log "INFO" "Removing Docker deployment..."
    
    # Remove containers
    local containers=$(docker ps -a --format "{{.Names}}" | grep sagaos || true)
    for container in $containers; do
        docker rm -f "$container" 2>/dev/null || true
        log "INFO" "Removed container: $container"
    done
    
    # Remove images
    local images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep sagaos || true)
    for image in $images; do
        docker rmi -f "$image" 2>/dev/null || true
        log "INFO" "Removed image: $image"
    done
    
    # Remove volumes
    local volumes=$(docker volume ls --format "{{.Name}}" | grep sagaos || true)
    for volume in $volumes; do
        docker volume rm "$volume" 2>/dev/null || true
        log "INFO" "Removed volume: $volume"
    done
    
    # Remove networks
    local networks=$(docker network ls --format "{{.Name}}" | grep sagaos || true)
    for network in $networks; do
        docker network rm "$network" 2>/dev/null || true
        log "INFO" "Removed network: $network"
    done
    
    # Remove compose files
    rm -f docker-compose*.yml .env* 2>/dev/null || true
    log "INFO" "Removed Docker Compose files"
}

# Function to remove native deployment
remove_native_deployment() {
    log "INFO" "Removing native deployment..."
    
    # Disable and remove systemd services
    local services=("sagaos-api" "sagaos-frontend")
    for service in "${services[@]}"; do
        if [ -f "/etc/systemd/system/$service.service" ]; then
            systemctl disable "$service" 2>/dev/null || true
            rm -f "/etc/systemd/system/$service.service"
            log "INFO" "Removed systemd service: $service"
        fi
    done
    
    # Reload systemd
    systemctl daemon-reload
    
    # Remove application directory
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        log "INFO" "Removed application directory: $INSTALL_DIR"
    fi
}

# Function to remove configurations
remove_configurations() {
    if [ "$REMOVE_CONFIGURATIONS" = false ]; then
        log "INFO" "Keeping configuration files"
        return 0
    fi
    
    log "INFO" "Removing configuration files..."
    
    # Remove Kea configurations (keep original system configs)
    if [ -f "/etc/kea/kea-dhcp4.conf.sagaos" ]; then
        rm -f /etc/kea/kea-dhcp4.conf.sagaos
        log "INFO" "Removed SagaOS Kea configuration"
    fi
    
    if [ -f "/etc/kea/kea-ctrl-agent.conf.sagaos" ]; then
        rm -f /etc/kea/kea-ctrl-agent.conf.sagaos
        log "INFO" "Removed SagaOS Kea Control Agent configuration"
    fi
    
    # Remove BIND9 configurations (keep original system configs)
    if [ -f "/etc/bind/named.conf.local.sagaos" ]; then
        rm -f /etc/bind/named.conf.local.sagaos
        log "INFO" "Removed SagaOS BIND9 configuration"
    fi
    
    if [ -d "/etc/bind/keys" ]; then
        rm -rf /etc/bind/keys
        log "INFO" "Removed BIND9 keys directory"
    fi
    
    # Remove Nginx site configuration
    if [ -f "/etc/nginx/sites-available/sagaos" ]; then
        rm -f /etc/nginx/sites-available/sagaos
        rm -f /etc/nginx/sites-enabled/sagaos
        log "INFO" "Removed Nginx site configuration"
    fi
}

# Function to remove database
remove_database() {
    if [ "$REMOVE_DATABASE" = false ]; then
        log "INFO" "Keeping database"
        return 0
    fi
    
    log "INFO" "Removing database..."
    
    if [ "$DOCKER_DEPLOYMENT" = true ]; then
        # Remove database container and volume
        docker rm -f sagaos-postgres-prod 2>/dev/null || true
        docker volume rm sagaos_postgres_data 2>/dev/null || true
        log "INFO" "Removed database container and volume"
    else
        # Remove database and user
        if command -v psql >/dev/null 2>&1; then
            sudo -u postgres psql << EOF 2>/dev/null || true
DROP DATABASE IF EXISTS kea;
DROP USER IF EXISTS admin;
\q
EOF
            log "INFO" "Removed database and user"
        fi
    fi
}

# Function to remove system users
remove_users() {
    if [ "$REMOVE_USERS" = false ]; then
        log "INFO" "Keeping system users"
        return 0
    fi
    
    log "INFO" "Removing system users..."
    
    # Remove sagaos user
    if id "sagaos" >/dev/null 2>&1; then
        userdel -r sagaos 2>/dev/null || true
        log "INFO" "Removed user: sagaos"
    fi
}

# Function to remove logs
remove_logs() {
    if [ "$REMOVE_LOGS" = false ]; then
        log "INFO" "Keeping log files"
        return 0
    fi
    
    log "INFO" "Removing log files..."
    
    # Remove SagaOS log directory
    if [ -d "/var/log/sagaos" ]; then
        rm -rf /var/log/sagaos
        log "INFO" "Removed log directory: /var/log/sagaos"
    fi
    
    # Remove logrotate configuration
    if [ -f "/etc/logrotate.d/sagaos" ]; then
        rm -f /etc/logrotate.d/sagaos
        log "INFO" "Removed logrotate configuration"
    fi
}

# Function to cleanup remaining files
cleanup_remaining_files() {
    log "INFO" "Cleaning up remaining files..."
    
    # Remove any remaining SagaOS files
    find /tmp -name "*sagaos*" -type f -delete 2>/dev/null || true
    find /var/tmp -name "*sagaos*" -type f -delete 2>/dev/null || true
    
    # Remove cron jobs (if any)
    crontab -l 2>/dev/null | grep -v sagaos | crontab - 2>/dev/null || true
    
    # Remove from PATH modifications (if any)
    sed -i '/sagaos/d' /etc/environment 2>/dev/null || true
    
    log "INFO" "Cleanup completed"
}

# Function to generate uninstall report
generate_report() {
    local report_file="/tmp/sagaos-uninstall-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
SagaOS Kea Pilot - Uninstall Report
==================================

Uninstall Date: $(date)
Hostname: $(hostname)
OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
Deployment Type: $([ "$DOCKER_DEPLOYMENT" = true ] && echo "Docker" || echo "Native")

Uninstall Options:
- Backup Created: $([ "$BACKUP_BEFORE_UNINSTALL" = true ] && echo "Yes ($BACKUP_DIR)" || echo "No")
- Database Removed: $([ "$REMOVE_DATABASE" = true ] && echo "Yes" || echo "No")
- Configurations Removed: $([ "$REMOVE_CONFIGURATIONS" = true ] && echo "Yes" || echo "No")
- Logs Removed: $([ "$REMOVE_LOGS" = true ] && echo "Yes" || echo "No")
- Users Removed: $([ "$REMOVE_USERS" = true ] && echo "Yes" || echo "No")

Removed Components:
$(cat "$LOG_FILE" | grep "Removed" | tail -20)

Remaining Files:
$(find /opt -name "*sagaos*" 2>/dev/null || echo "None found")
$(find /etc -name "*sagaos*" 2>/dev/null || echo "None found")

System Status After Uninstall:
- Running Processes: $(ps aux | grep -E "(kea|bind|nginx|postgres)" | grep -v grep | wc -l) related processes
- Open Ports: $(netstat -tlnp 2>/dev/null | grep -E "(53|67|68|80|443|3001|5432|8000)" | wc -l) relevant ports

EOF
    
    log "INFO" "Uninstall report generated: $report_file"
    echo -e "${BLUE}📄 Full report: $report_file${NC}"
}

# Function to display uninstall summary
display_summary() {
    echo ""
    echo -e "${GREEN}🗑️  Uninstall Complete!${NC}"
    echo -e "${BLUE}======================${NC}"
    echo ""
    echo -e "${CYAN}📋 Uninstall Summary:${NC}"
    echo -e "  🗂️  Application: ${GREEN}Removed${NC}"
    [ "$DOCKER_DEPLOYMENT" = true ] && echo -e "  🐳 Docker Components: ${GREEN}Removed${NC}"
    [ "$REMOVE_CONFIGURATIONS" = true ] && echo -e "  ⚙️  Configurations: ${GREEN}Removed${NC}" || echo -e "  ⚙️  Configurations: ${YELLOW}Preserved${NC}"
    [ "$REMOVE_DATABASE" = true ] && echo -e "  🗄️  Database: ${GREEN}Removed${NC}" || echo -e "  🗄️  Database: ${YELLOW}Preserved${NC}"
    [ "$REMOVE_USERS" = true ] && echo -e "  👤 System Users: ${GREEN}Removed${NC}" || echo -e "  👤 System Users: ${YELLOW}Preserved${NC}"
    [ "$REMOVE_LOGS" = true ] && echo -e "  📋 Log Files: ${GREEN}Removed${NC}" || echo -e "  📋 Log Files: ${YELLOW}Preserved${NC}"
    echo ""
    
    if [ "$BACKUP_BEFORE_UNINSTALL" = true ]; then
        echo -e "${CYAN}💾 Backup Information:${NC}"
        echo -e "  📁 Location: ${YELLOW}$BACKUP_DIR${NC}"
        echo -e "  📊 Size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "Unknown")"
        echo ""
    fi
    
    echo -e "${CYAN}🔄 To Reinstall SagaOS:${NC}"
    echo -e "  📥 Download: ${YELLOW}git clone https://github.com/sagaos/kea-pilot${NC}"
    echo -e "  🚀 Install: ${YELLOW}sudo ./install.sh${NC}"
    echo ""
    
    if [ "$REMOVE_DATABASE" = false ]; then
        echo -e "${YELLOW}⚠️  Database preserved - you may want to remove it manually if not needed${NC}"
        echo -e "  🗄️  Remove database: ${YELLOW}sudo -u postgres psql -c 'DROP DATABASE kea; DROP USER admin;'${NC}"
        echo ""
    fi
    
    echo -e "${GREEN}Thank you for using SagaOS! 👋${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        --no-backup)
            BACKUP_BEFORE_UNINSTALL=false
            shift
            ;;
        --remove-database)
            REMOVE_DATABASE=true
            shift
            ;;
        --keep-configurations)
            REMOVE_CONFIGURATIONS=false
            shift
            ;;
        --remove-logs)
            REMOVE_LOGS=true
            shift
            ;;
        --keep-users)
            REMOVE_USERS=false
            shift
            ;;
        --force)
            FORCE_REMOVAL=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --docker)
            DOCKER_DEPLOYMENT=true
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

# Main uninstall function
main() {
    log "INFO" "Starting SagaOS uninstall..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log "ERROR" "This script must be run as root (use sudo)"
        exit 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log "INFO" "DRY RUN MODE - No changes will be made"
        detect_deployment || log "INFO" "Would report: No installation found"
        log "INFO" "Would create backup at: $BACKUP_DIR"
        log "INFO" "Would stop services and remove components"
        exit 0
    fi
    
    # Pre-uninstall checks
    if ! detect_deployment; then
        log "WARN" "No SagaOS installation detected"
        exit 0
    fi
    
    # Confirm uninstall
    confirm_uninstall
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Uninstall process
    create_backup
    stop_services
    
    if [ "$DOCKER_DEPLOYMENT" = true ]; then
        remove_docker_deployment
    else
        remove_native_deployment
    fi
    
    remove_configurations
    remove_database
    remove_users
    remove_logs
    cleanup_remaining_files
    
    # Generate report and summary
    generate_report
    display_summary
    
    log "INFO" "Uninstall completed successfully!"
}

# Run main function
main "$@"
