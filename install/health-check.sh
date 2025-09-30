#!/bin/bash

# ============================================================================
# SagaOS Kea Pilot - Health Check & Validation Script
# ============================================================================
# Comprehensive system validation and health monitoring
# Supports both native and Docker deployments
# 
# Usage: ./install/health-check.sh [OPTIONS]
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_VERSION="1.0.0"
SCRIPT_NAME="SagaOS Health Check"
LOG_FILE="/var/log/sagaos-health-check.log"
INSTALL_DIR="/opt/sagaos"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Health check options
CHECK_DATABASE=true
CHECK_API=true
CHECK_FRONTEND=true
CHECK_KEA=true
CHECK_BIND9=true
CHECK_DOCKER=false
VERBOSE=false
CONTINUOUS=false
INTERVAL=30

# Health status counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

echo -e "${CYAN}"
cat << "EOF"
 ____                   ___  ____  
/ ___|  __ _  __ _  __ _/ _ \/ ___| 
\___ \ / _` |/ _` |/ _` | | | \___ \ 
 ___) | (_| | (_| | (_| | |_| |___) |
|____/ \__,_|\__, |\__,_|\___/|____/ 
             |___/                  
    Health Check & Validation
EOF
echo -e "${NC}"

echo -e "${GREEN}🏥 $SCRIPT_NAME v$SCRIPT_VERSION${NC}"
echo -e "${BLUE}📅 $(date)${NC}"
echo ""

# Function to log messages
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "PASS")
            echo -e "${GREEN}✅ $message${NC}"
            ((PASSED_CHECKS++))
            ;;
        "FAIL")
            echo -e "${RED}❌ $message${NC}"
            ((FAILED_CHECKS++))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ((WARNING_CHECKS++))
            ;;
        "INFO")
            echo -e "${BLUE}📋 $message${NC}"
            ;;
        "DEBUG")
            [ "$VERBOSE" = true ] && echo -e "${PURPLE}🔍 $message${NC}"
            ;;
        *)
            echo -e "${CYAN}📋 $message${NC}"
            ;;
    esac
    
    ((TOTAL_CHECKS++))
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Perform comprehensive health checks on SagaOS installation.

OPTIONS:
    -h, --help              Show this help message
    --skip-database         Skip database health checks
    --skip-api              Skip API health checks
    --skip-frontend         Skip frontend health checks
    --skip-kea              Skip Kea DHCP health checks
    --skip-bind9            Skip BIND9 DNS health checks
    --docker                Check Docker deployment instead of native
    -c, --continuous        Run continuous monitoring
    -i, --interval SECONDS  Interval for continuous monitoring (default: 30)
    -v, --verbose           Enable verbose output
    --json                  Output results in JSON format

HEALTH CHECKS:
    🗄️  Database connectivity and schema validation
    🌐 API Gateway endpoints and authentication
    📱 Frontend accessibility and functionality
    🏠 Kea DHCP server status and configuration
    🌐 BIND9 DNS server status and zones
    🐳 Docker container health (if --docker)
    🔧 System resources and performance
    📊 Log file analysis and error detection

EXAMPLES:
    $0                      # Full health check
    $0 --docker             # Docker deployment check
    $0 --continuous         # Continuous monitoring
    $0 --skip-bind9         # Skip DNS checks
    $0 --verbose            # Detailed output

EXIT CODES:
    0   All checks passed
    1   Some checks failed
    2   Critical failures detected
    3   Configuration error

EOF
}

# Function to detect deployment type
detect_deployment() {
    if command -v docker >/dev/null 2>&1 && docker ps | grep -q sagaos; then
        log "INFO" "Docker deployment detected"
        CHECK_DOCKER=true
        return 0
    elif [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/package.json" ]; then
        log "INFO" "Native deployment detected"
        CHECK_DOCKER=false
        return 0
    else
        log "WARN" "No SagaOS deployment detected"
        return 1
    fi
}

# Function to check database health
check_database() {
    if [ "$CHECK_DATABASE" = false ]; then
        return 0
    fi
    
    log "INFO" "Checking database health..."
    
    local db_host="localhost"
    local db_port="5432"
    local db_name="kea"
    local db_user="admin"
    
    if [ "$CHECK_DOCKER" = true ]; then
        # Check Docker database container
        if docker ps | grep -q sagaos-postgres; then
            log "PASS" "PostgreSQL container is running"
            
            # Test database connection
            if docker exec sagaos-postgres-prod pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
                log "PASS" "Database connection successful"
            else
                log "FAIL" "Database connection failed"
                return 1
            fi
            
            # Check database size
            local db_size=$(docker exec sagaos-postgres-prod psql -U "$db_user" -d "$db_name" -t -c "SELECT pg_size_pretty(pg_database_size('$db_name'));" 2>/dev/null | xargs)
            if [ -n "$db_size" ]; then
                log "PASS" "Database size: $db_size"
            else
                log "WARN" "Could not determine database size"
            fi
        else
            log "FAIL" "PostgreSQL container not running"
            return 1
        fi
    else
        # Check native database installation
        if systemctl is-active postgresql >/dev/null 2>&1; then
            log "PASS" "PostgreSQL service is running"
            
            # Test database connection
            if sudo -u postgres psql -d "$db_name" -c "SELECT 1;" >/dev/null 2>&1; then
                log "PASS" "Database connection successful"
            else
                log "FAIL" "Database connection failed"
                return 1
            fi
        else
            log "FAIL" "PostgreSQL service not running"
            return 1
        fi
    fi
    
    # Check database tables
    local table_count
    if [ "$CHECK_DOCKER" = true ]; then
        table_count=$(docker exec sagaos-postgres-prod psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    else
        table_count=$(sudo -u postgres psql -d "$db_name" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    fi
    
    if [ "$table_count" -gt 0 ]; then
        log "PASS" "Database schema loaded ($table_count tables)"
    else
        log "WARN" "Database schema appears empty"
    fi
    
    return 0
}

# Function to check API health
check_api() {
    if [ "$CHECK_API" = false ]; then
        return 0
    fi
    
    log "INFO" "Checking API Gateway health..."
    
    local api_url="http://localhost:3001"
    
    # Check if API is responding
    if curl -s -f "$api_url/api/health" >/dev/null 2>&1; then
        log "PASS" "API Gateway is responding"
        
        # Check API health endpoint details
        local health_response=$(curl -s "$api_url/api/health" 2>/dev/null)
        if echo "$health_response" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
            log "PASS" "API health status: healthy"
        else
            log "WARN" "API health status: unknown"
        fi
        
        # Check API version
        local version=$(echo "$health_response" | jq -r '.version // "unknown"' 2>/dev/null)
        log "INFO" "API version: $version"
        
    else
        log "FAIL" "API Gateway not responding"
        
        # Check if service is running
        if [ "$CHECK_DOCKER" = true ]; then
            if docker ps | grep -q sagaos-backend; then
                log "INFO" "Backend container is running but not responding"
            else
                log "FAIL" "Backend container not running"
            fi
        else
            if systemctl is-active sagaos-api >/dev/null 2>&1; then
                log "INFO" "API service is running but not responding"
            else
                log "FAIL" "API service not running"
            fi
        fi
        return 1
    fi
    
    # Test authentication endpoint
    local auth_response=$(curl -s -w "%{http_code}" -o /dev/null "$api_url/api/auth/login" -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}' 2>/dev/null)
    if [ "$auth_response" = "200" ] || [ "$auth_response" = "401" ]; then
        log "PASS" "Authentication endpoint accessible"
    else
        log "WARN" "Authentication endpoint issues (HTTP $auth_response)"
    fi
    
    return 0
}

# Function to check frontend health
check_frontend() {
    if [ "$CHECK_FRONTEND" = false ]; then
        return 0
    fi
    
    log "INFO" "Checking frontend health..."
    
    local frontend_url="http://localhost"
    
    # Check if frontend is accessible
    if curl -s -f "$frontend_url" >/dev/null 2>&1; then
        log "PASS" "Frontend is accessible"
        
        # Check if it's serving the SagaOS application
        local page_content=$(curl -s "$frontend_url" 2>/dev/null)
        if echo "$page_content" | grep -q "SagaOS\|Kea Pilot"; then
            log "PASS" "SagaOS frontend content detected"
        else
            log "WARN" "Frontend content may not be SagaOS"
        fi
        
    else
        log "FAIL" "Frontend not accessible"
        
        # Check web server status
        if [ "$CHECK_DOCKER" = true ]; then
            if docker ps | grep -q sagaos-nginx; then
                log "INFO" "Nginx container is running but not responding"
            else
                log "FAIL" "Nginx container not running"
            fi
        else
            if systemctl is-active nginx >/dev/null 2>&1; then
                log "INFO" "Nginx service is running but not responding"
            else
                log "FAIL" "Nginx service not running"
            fi
        fi
        return 1
    fi
    
    return 0
}

# Function to check Kea DHCP health
check_kea() {
    if [ "$CHECK_KEA" = false ]; then
        return 0
    fi
    
    log "INFO" "Checking Kea DHCP health..."
    
    # Check Kea Control Agent
    local kea_ca_url="http://localhost:8000"
    
    if curl -s -f "$kea_ca_url" >/dev/null 2>&1; then
        log "PASS" "Kea Control Agent is responding"
        
        # Test Kea API with authentication
        local kea_response=$(curl -s -u "admin:admin" -X POST "$kea_ca_url" -H "Content-Type: application/json" -d '{"command":"config-get","service":["dhcp4"]}' 2>/dev/null)
        if echo "$kea_response" | jq -e '.result == 0' >/dev/null 2>&1; then
            log "PASS" "Kea DHCP4 configuration accessible"
        else
            log "WARN" "Kea DHCP4 configuration issues"
        fi
        
    else
        log "FAIL" "Kea Control Agent not responding"
        return 1
    fi
    
    # Check DHCP service status
    if [ "$CHECK_DOCKER" = true ]; then
        if docker ps | grep -q sagaos-kea-dhcp4; then
            log "PASS" "Kea DHCP4 container is running"
        else
            log "FAIL" "Kea DHCP4 container not running"
        fi
    else
        if systemctl is-active isc-kea-dhcp4-server >/dev/null 2>&1; then
            log "PASS" "Kea DHCP4 service is running"
        else
            log "FAIL" "Kea DHCP4 service not running"
        fi
    fi
    
    return 0
}

# Function to check BIND9 health
check_bind9() {
    if [ "$CHECK_BIND9" = false ]; then
        return 0
    fi
    
    log "INFO" "Checking BIND9 DNS health..."
    
    # Check DNS resolution
    if dig @localhost localhost >/dev/null 2>&1; then
        log "PASS" "DNS server is responding"
        
        # Check specific zone
        if dig @localhost sagaos.local >/dev/null 2>&1; then
            log "PASS" "SagaOS zone is resolvable"
        else
            log "WARN" "SagaOS zone not configured or not resolvable"
        fi
        
    else
        log "FAIL" "DNS server not responding"
        return 1
    fi
    
    # Check BIND9 service status
    if [ "$CHECK_DOCKER" = true ]; then
        if docker ps | grep -q sagaos-bind9; then
            log "PASS" "BIND9 container is running"
        else
            log "FAIL" "BIND9 container not running"
        fi
    else
        if systemctl is-active bind9 >/dev/null 2>&1 || systemctl is-active named >/dev/null 2>&1; then
            log "PASS" "BIND9 service is running"
        else
            log "FAIL" "BIND9 service not running"
        fi
    fi
    
    # Check rndc control
    if rndc status >/dev/null 2>&1; then
        log "PASS" "BIND9 rndc control working"
    else
        log "WARN" "BIND9 rndc control issues"
    fi
    
    return 0
}

# Function to check system resources
check_system_resources() {
    log "INFO" "Checking system resources..."
    
    # Check memory usage
    local mem_usage=$(free | awk '/^Mem:/{printf "%.1f", $3/$2 * 100.0}')
    if (( $(echo "$mem_usage < 80" | bc -l) )); then
        log "PASS" "Memory usage: ${mem_usage}%"
    elif (( $(echo "$mem_usage < 90" | bc -l) )); then
        log "WARN" "Memory usage high: ${mem_usage}%"
    else
        log "FAIL" "Memory usage critical: ${mem_usage}%"
    fi
    
    # Check disk usage
    local disk_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        log "PASS" "Disk usage: ${disk_usage}%"
    elif [ "$disk_usage" -lt 90 ]; then
        log "WARN" "Disk usage high: ${disk_usage}%"
    else
        log "FAIL" "Disk usage critical: ${disk_usage}%"
    fi
    
    # Check load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_count=$(nproc)
    local load_ratio=$(echo "scale=2; $load_avg / $cpu_count" | bc)
    
    if (( $(echo "$load_ratio < 0.7" | bc -l) )); then
        log "PASS" "Load average: $load_avg (${load_ratio} per CPU)"
    elif (( $(echo "$load_ratio < 1.0" | bc -l) )); then
        log "WARN" "Load average high: $load_avg (${load_ratio} per CPU)"
    else
        log "FAIL" "Load average critical: $load_avg (${load_ratio} per CPU)"
    fi
    
    return 0
}

# Function to check log files for errors
check_logs() {
    log "INFO" "Checking log files for errors..."
    
    local error_count=0
    
    # Check system logs
    if journalctl --since "1 hour ago" --priority=err --quiet; then
        error_count=$(journalctl --since "1 hour ago" --priority=err --no-pager | wc -l)
        if [ "$error_count" -eq 0 ]; then
            log "PASS" "No system errors in last hour"
        else
            log "WARN" "$error_count system errors in last hour"
        fi
    fi
    
    # Check SagaOS specific logs
    if [ -d "/var/log/sagaos" ]; then
        local sagaos_errors=$(find /var/log/sagaos -name "*.log" -mtime -1 -exec grep -l "ERROR\|FATAL" {} \; 2>/dev/null | wc -l)
        if [ "$sagaos_errors" -eq 0 ]; then
            log "PASS" "No SagaOS errors in recent logs"
        else
            log "WARN" "SagaOS errors found in $sagaos_errors log files"
        fi
    fi
    
    return 0
}

# Function to display health summary
display_summary() {
    echo ""
    echo -e "${CYAN}🏥 Health Check Summary${NC}"
    echo -e "${BLUE}======================${NC}"
    echo ""
    echo -e "${GREEN}✅ Passed: $PASSED_CHECKS${NC}"
    echo -e "${YELLOW}⚠️  Warnings: $WARNING_CHECKS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_CHECKS${NC}"
    echo -e "${BLUE}📊 Total: $TOTAL_CHECKS${NC}"
    echo ""
    
    local success_rate=$(echo "scale=1; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc)
    echo -e "${CYAN}Success Rate: ${success_rate}%${NC}"
    
    if [ "$FAILED_CHECKS" -eq 0 ]; then
        echo -e "${GREEN}🎉 All critical checks passed!${NC}"
        return 0
    elif [ "$FAILED_CHECKS" -lt 3 ]; then
        echo -e "${YELLOW}⚠️  Some issues detected, but system is functional${NC}"
        return 1
    else
        echo -e "${RED}🚨 Critical issues detected, system may not be functional${NC}"
        return 2
    fi
}

# Function for continuous monitoring
continuous_monitoring() {
    log "INFO" "Starting continuous monitoring (interval: ${INTERVAL}s)"
    log "INFO" "Press Ctrl+C to stop"
    
    while true; do
        echo ""
        echo -e "${CYAN}🔄 Health Check - $(date)${NC}"
        echo -e "${BLUE}================================${NC}"
        
        # Reset counters
        TOTAL_CHECKS=0
        PASSED_CHECKS=0
        FAILED_CHECKS=0
        WARNING_CHECKS=0
        
        # Run all checks
        detect_deployment
        check_database
        check_api
        check_frontend
        check_kea
        check_bind9
        check_system_resources
        check_logs
        
        # Display summary
        display_summary
        
        # Wait for next interval
        sleep "$INTERVAL"
    done
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        --skip-database)
            CHECK_DATABASE=false
            shift
            ;;
        --skip-api)
            CHECK_API=false
            shift
            ;;
        --skip-frontend)
            CHECK_FRONTEND=false
            shift
            ;;
        --skip-kea)
            CHECK_KEA=false
            shift
            ;;
        --skip-bind9)
            CHECK_BIND9=false
            shift
            ;;
        --docker)
            CHECK_DOCKER=true
            shift
            ;;
        -c|--continuous)
            CONTINUOUS=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            log "FAIL" "Unknown option: $1"
            usage
            exit 3
            ;;
    esac
done

# Main execution
main() {
    log "INFO" "Starting SagaOS health check..."
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    if [ "$CONTINUOUS" = true ]; then
        continuous_monitoring
    else
        # Single health check run
        detect_deployment
        check_database
        check_api
        check_frontend
        check_kea
        check_bind9
        check_system_resources
        check_logs
        
        # Display final summary
        display_summary
    fi
}

# Run main function
main "$@"
