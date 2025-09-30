#!/bin/bash

# ============================================================================
# SagaOS Kea Pilot - Installation Validation Script
# ============================================================================
# Comprehensive installation validation and functional testing
# Validates complete end-to-end functionality
# 
# Usage: ./install/validate-installation.sh [OPTIONS]
# ============================================================================

set -euo pipefail

# Script configuration
SCRIPT_VERSION="1.0.0"
SCRIPT_NAME="SagaOS Installation Validator"
LOG_FILE="/var/log/sagaos-validation.log"
TEST_RESULTS_FILE="/tmp/sagaos-validation-results.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Validation options
VALIDATE_INSTALLATION=true
VALIDATE_CONFIGURATION=true
VALIDATE_FUNCTIONALITY=true
VALIDATE_SECURITY=true
VALIDATE_PERFORMANCE=true
GENERATE_REPORT=true
VERBOSE=false

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

echo -e "${CYAN}"
cat << "EOF"
 ____                   ___  ____  
/ ___|  __ _  __ _  __ _/ _ \/ ___| 
\___ \ / _` |/ _` |/ _` | | | \___ \ 
 ___) | (_| | (_| | (_| | |_| |___) |
|____/ \__,_|\__, |\__,_|\___/|____/ 
             |___/                  
    Installation Validation
EOF
echo -e "${NC}"

echo -e "${GREEN}🔍 $SCRIPT_NAME v$SCRIPT_VERSION${NC}"
echo -e "${BLUE}📅 $(date)${NC}"
echo ""

# Function to log test results
log_test() {
    local status="$1"
    local test_name="$2"
    local message="$3"
    local details="${4:-}"
    
    ((TOTAL_TESTS++))
    
    case "$status" in
        "PASS")
            echo -e "${GREEN}✅ $test_name: $message${NC}"
            ((PASSED_TESTS++))
            ;;
        "FAIL")
            echo -e "${RED}❌ $test_name: $message${NC}"
            [ -n "$details" ] && echo -e "${RED}   Details: $details${NC}"
            ((FAILED_TESTS++))
            ;;
        "SKIP")
            echo -e "${YELLOW}⏭️  $test_name: $message${NC}"
            ((SKIPPED_TESTS++))
            ;;
        "INFO")
            echo -e "${BLUE}📋 $test_name: $message${NC}"
            ;;
    esac
    
    # Log to file
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$status] $test_name: $message" >> "$LOG_FILE"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Validate SagaOS installation and perform comprehensive testing.

OPTIONS:
    -h, --help              Show this help message
    --skip-installation     Skip installation validation
    --skip-configuration    Skip configuration validation
    --skip-functionality    Skip functionality testing
    --skip-security         Skip security validation
    --skip-performance      Skip performance testing
    --no-report             Skip generating validation report
    -v, --verbose           Enable verbose output

VALIDATION CATEGORIES:
    🔧 Installation Validation
       - Component installation verification
       - Service status checks
       - File and directory validation
       - Permission verification

    ⚙️  Configuration Validation
       - Configuration file syntax
       - Service configuration validation
       - Database schema verification
       - Network configuration checks

    🚀 Functionality Testing
       - API endpoint testing
       - Authentication flow testing
       - DHCP functionality testing
       - DNS resolution testing
       - Frontend functionality testing

    🔐 Security Validation
       - Default password checks
       - SSL/TLS configuration
       - Firewall configuration
       - File permission auditing

    📊 Performance Testing
       - Response time testing
       - Resource usage validation
       - Load testing (basic)
       - Database performance

EXAMPLES:
    $0                      # Full validation
    $0 --skip-performance   # Skip performance tests
    $0 --verbose            # Detailed output
    $0 --no-report          # Skip report generation

EXIT CODES:
    0   All validations passed
    1   Some validations failed
    2   Critical failures detected
    3   Configuration error

EOF
}

# Function to validate installation
validate_installation() {
    if [ "$VALIDATE_INSTALLATION" = false ]; then
        log_test "SKIP" "Installation" "Skipped by user request"
        return 0
    fi
    
    echo -e "${CYAN}🔧 Installation Validation${NC}"
    echo -e "${BLUE}=========================${NC}"
    
    # Check if Docker or native installation
    local deployment_type="unknown"
    if command -v docker >/dev/null 2>&1 && docker ps | grep -q sagaos; then
        deployment_type="docker"
        log_test "INFO" "Deployment" "Docker deployment detected"
    elif [ -d "/opt/sagaos" ]; then
        deployment_type="native"
        log_test "INFO" "Deployment" "Native deployment detected"
    else
        log_test "FAIL" "Deployment" "No SagaOS installation detected"
        return 1
    fi
    
    # Validate core components
    if [ "$deployment_type" = "docker" ]; then
        # Docker validation
        local containers=("sagaos-postgres-prod" "sagaos-backend-prod" "sagaos-nginx-prod" "sagaos-kea-dhcp4-prod" "sagaos-kea-ca-prod" "sagaos-bind9-prod")
        for container in "${containers[@]}"; do
            if docker ps --format "table {{.Names}}" | grep -q "$container"; then
                log_test "PASS" "Container" "$container is running"
            else
                log_test "FAIL" "Container" "$container is not running"
            fi
        done
    else
        # Native validation
        local services=("postgresql" "sagaos-api" "nginx" "isc-kea-dhcp4-server" "isc-kea-ctrl-agent" "bind9")
        for service in "${services[@]}"; do
            if systemctl is-active "$service" >/dev/null 2>&1; then
                log_test "PASS" "Service" "$service is active"
            else
                log_test "FAIL" "Service" "$service is not active"
            fi
        done
    fi
    
    # Check required directories
    local directories=("/var/log/sagaos" "/opt/sagaos" "/etc/kea" "/etc/bind")
    for dir in "${directories[@]}"; do
        if [ -d "$dir" ]; then
            log_test "PASS" "Directory" "$dir exists"
        else
            log_test "FAIL" "Directory" "$dir missing"
        fi
    done
    
    # Check required files
    local files=("/etc/kea/kea-dhcp4.conf" "/etc/kea/kea-ctrl-agent.conf" "/etc/bind/named.conf.local")
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            log_test "PASS" "File" "$file exists"
        else
            log_test "FAIL" "File" "$file missing"
        fi
    done
    
    echo ""
}

# Function to validate configuration
validate_configuration() {
    if [ "$VALIDATE_CONFIGURATION" = false ]; then
        log_test "SKIP" "Configuration" "Skipped by user request"
        return 0
    fi
    
    echo -e "${CYAN}⚙️  Configuration Validation${NC}"
    echo -e "${BLUE}===========================${NC}"
    
    # Validate Kea configuration
    if command -v kea-dhcp4 >/dev/null 2>&1; then
        if kea-dhcp4 -t /etc/kea/kea-dhcp4.conf >/dev/null 2>&1; then
            log_test "PASS" "Kea Config" "kea-dhcp4.conf syntax is valid"
        else
            log_test "FAIL" "Kea Config" "kea-dhcp4.conf syntax error"
        fi
    else
        log_test "SKIP" "Kea Config" "Kea not installed"
    fi
    
    # Validate BIND9 configuration
    if command -v named-checkconf >/dev/null 2>&1; then
        if named-checkconf /etc/bind/named.conf >/dev/null 2>&1; then
            log_test "PASS" "BIND9 Config" "named.conf syntax is valid"
        else
            log_test "FAIL" "BIND9 Config" "named.conf syntax error"
        fi
    else
        log_test "SKIP" "BIND9 Config" "BIND9 not installed"
    fi
    
    # Validate Nginx configuration
    if command -v nginx >/dev/null 2>&1; then
        if nginx -t >/dev/null 2>&1; then
            log_test "PASS" "Nginx Config" "nginx.conf syntax is valid"
        else
            log_test "FAIL" "Nginx Config" "nginx.conf syntax error"
        fi
    else
        log_test "SKIP" "Nginx Config" "Nginx not installed"
    fi
    
    # Validate database schema
    if command -v psql >/dev/null 2>&1; then
        local table_count=$(sudo -u postgres psql -d kea -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
        if [ "$table_count" -gt 0 ]; then
            log_test "PASS" "Database Schema" "$table_count tables found"
        else
            log_test "FAIL" "Database Schema" "No tables found"
        fi
    else
        log_test "SKIP" "Database Schema" "PostgreSQL not available"
    fi
    
    # Check environment configuration
    if [ -f ".env" ]; then
        log_test "PASS" "Environment" ".env file exists"
        
        # Check for required variables
        local required_vars=("DB_HOST" "DB_USER" "DB_PASSWORD" "KEA_CA_USER" "KEA_CA_PASSWORD")
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" .env; then
                log_test "PASS" "Environment" "$var is configured"
            else
                log_test "FAIL" "Environment" "$var is missing"
            fi
        done
    else
        log_test "FAIL" "Environment" ".env file missing"
    fi
    
    echo ""
}

# Function to test functionality
validate_functionality() {
    if [ "$VALIDATE_FUNCTIONALITY" = false ]; then
        log_test "SKIP" "Functionality" "Skipped by user request"
        return 0
    fi
    
    echo -e "${CYAN}🚀 Functionality Testing${NC}"
    echo -e "${BLUE}========================${NC}"
    
    # Test API endpoints
    local api_url="http://localhost:3001"
    
    # Test health endpoint
    if curl -s -f "$api_url/api/health" >/dev/null 2>&1; then
        log_test "PASS" "API Health" "Health endpoint responding"
    else
        log_test "FAIL" "API Health" "Health endpoint not responding"
    fi
    
    # Test authentication endpoint
    local auth_response=$(curl -s -w "%{http_code}" -o /dev/null "$api_url/api/auth/login" -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}' 2>/dev/null)
    if [ "$auth_response" = "200" ]; then
        log_test "PASS" "Authentication" "Login successful with admin/admin"
    elif [ "$auth_response" = "401" ]; then
        log_test "PASS" "Authentication" "Login endpoint responding (credentials rejected)"
    else
        log_test "FAIL" "Authentication" "Login endpoint error (HTTP $auth_response)"
    fi
    
    # Test Kea Control Agent
    local kea_ca_url="http://localhost:8000"
    if curl -s -u "admin:admin" -f "$kea_ca_url" >/dev/null 2>&1; then
        log_test "PASS" "Kea CA" "Control Agent responding"
        
        # Test Kea API command
        local kea_response=$(curl -s -u "admin:admin" -X POST "$kea_ca_url" -H "Content-Type: application/json" -d '{"command":"config-get","service":["dhcp4"]}' 2>/dev/null)
        if echo "$kea_response" | jq -e '.result == 0' >/dev/null 2>&1; then
            log_test "PASS" "Kea API" "DHCP4 configuration accessible"
        else
            log_test "FAIL" "Kea API" "DHCP4 configuration not accessible"
        fi
    else
        log_test "FAIL" "Kea CA" "Control Agent not responding"
    fi
    
    # Test DNS resolution
    if dig @localhost localhost >/dev/null 2>&1; then
        log_test "PASS" "DNS Resolution" "Local DNS server responding"
    else
        log_test "FAIL" "DNS Resolution" "Local DNS server not responding"
    fi
    
    # Test frontend accessibility
    local frontend_url="http://localhost"
    if curl -s -f "$frontend_url" >/dev/null 2>&1; then
        log_test "PASS" "Frontend" "Web interface accessible"
        
        # Check if it contains SagaOS content
        local page_content=$(curl -s "$frontend_url" 2>/dev/null)
        if echo "$page_content" | grep -q "SagaOS\|Kea Pilot"; then
            log_test "PASS" "Frontend Content" "SagaOS interface detected"
        else
            log_test "FAIL" "Frontend Content" "SagaOS interface not detected"
        fi
    else
        log_test "FAIL" "Frontend" "Web interface not accessible"
    fi
    
    echo ""
}

# Function to validate security
validate_security() {
    if [ "$VALIDATE_SECURITY" = false ]; then
        log_test "SKIP" "Security" "Skipped by user request"
        return 0
    fi
    
    echo -e "${CYAN}🔐 Security Validation${NC}"
    echo -e "${BLUE}======================${NC}"
    
    # Check for default passwords
    if grep -q "admin.*admin" .env 2>/dev/null; then
        log_test "FAIL" "Default Passwords" "Default admin/admin credentials detected"
    else
        log_test "PASS" "Default Passwords" "Default credentials not found in .env"
    fi
    
    # Check file permissions
    local sensitive_files=("/etc/kea/kea-ctrl-agent.conf" "/etc/bind/rndc.conf" ".env")
    for file in "${sensitive_files[@]}"; do
        if [ -f "$file" ]; then
            local perms=$(stat -c "%a" "$file" 2>/dev/null)
            if [ "$perms" = "600" ] || [ "$perms" = "640" ] || [ "$perms" = "644" ]; then
                log_test "PASS" "File Permissions" "$file has secure permissions ($perms)"
            else
                log_test "FAIL" "File Permissions" "$file has insecure permissions ($perms)"
            fi
        fi
    done
    
    # Check for SSL/TLS configuration
    if [ -d "/etc/nginx/ssl" ] && [ "$(ls -A /etc/nginx/ssl 2>/dev/null)" ]; then
        log_test "PASS" "SSL/TLS" "SSL certificates directory exists and contains files"
    else
        log_test "FAIL" "SSL/TLS" "SSL certificates not configured"
    fi
    
    # Check firewall status
    if command -v ufw >/dev/null 2>&1; then
        if ufw status | grep -q "Status: active"; then
            log_test "PASS" "Firewall" "UFW firewall is active"
        else
            log_test "FAIL" "Firewall" "UFW firewall is not active"
        fi
    elif command -v firewall-cmd >/dev/null 2>&1; then
        if firewall-cmd --state | grep -q "running"; then
            log_test "PASS" "Firewall" "firewalld is running"
        else
            log_test "FAIL" "Firewall" "firewalld is not running"
        fi
    else
        log_test "SKIP" "Firewall" "No supported firewall found"
    fi
    
    echo ""
}

# Function to test performance
validate_performance() {
    if [ "$VALIDATE_PERFORMANCE" = false ]; then
        log_test "SKIP" "Performance" "Skipped by user request"
        return 0
    fi
    
    echo -e "${CYAN}📊 Performance Testing${NC}"
    echo -e "${BLUE}======================${NC}"
    
    # Test API response time
    local api_url="http://localhost:3001/api/health"
    local response_time=$(curl -s -w "%{time_total}" -o /dev/null "$api_url" 2>/dev/null)
    if (( $(echo "$response_time < 1.0" | bc -l) )); then
        log_test "PASS" "API Response Time" "${response_time}s (good)"
    elif (( $(echo "$response_time < 3.0" | bc -l) )); then
        log_test "PASS" "API Response Time" "${response_time}s (acceptable)"
    else
        log_test "FAIL" "API Response Time" "${response_time}s (slow)"
    fi
    
    # Test database query performance
    if command -v psql >/dev/null 2>&1; then
        local query_time=$(time (sudo -u postgres psql -d kea -c "SELECT COUNT(*) FROM information_schema.tables;" >/dev/null 2>&1) 2>&1 | grep real | awk '{print $2}')
        log_test "PASS" "Database Query" "Query completed in $query_time"
    else
        log_test "SKIP" "Database Query" "PostgreSQL not available"
    fi
    
    # Check system resource usage
    local mem_usage=$(free | awk '/^Mem:/{printf "%.1f", $3/$2 * 100.0}')
    if (( $(echo "$mem_usage < 70" | bc -l) )); then
        log_test "PASS" "Memory Usage" "${mem_usage}% (good)"
    elif (( $(echo "$mem_usage < 85" | bc -l) )); then
        log_test "PASS" "Memory Usage" "${mem_usage}% (acceptable)"
    else
        log_test "FAIL" "Memory Usage" "${mem_usage}% (high)"
    fi
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    if (( $(echo "$cpu_usage < 50" | bc -l) )); then
        log_test "PASS" "CPU Usage" "${cpu_usage}% (good)"
    elif (( $(echo "$cpu_usage < 80" | bc -l) )); then
        log_test "PASS" "CPU Usage" "${cpu_usage}% (acceptable)"
    else
        log_test "FAIL" "CPU Usage" "${cpu_usage}% (high)"
    fi
    
    echo ""
}

# Function to generate validation report
generate_report() {
    if [ "$GENERATE_REPORT" = false ]; then
        return 0
    fi
    
    echo -e "${CYAN}📋 Generating Validation Report${NC}"
    echo -e "${BLUE}===============================${NC}"
    
    local report_file="/tmp/sagaos-validation-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
SagaOS Kea Pilot - Installation Validation Report
================================================

Generated: $(date)
Hostname: $(hostname)
OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
Kernel: $(uname -r)

Test Summary:
- Total Tests: $TOTAL_TESTS
- Passed: $PASSED_TESTS
- Failed: $FAILED_TESTS
- Skipped: $SKIPPED_TESTS

Success Rate: $(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)%

Detailed Results:
$(cat "$LOG_FILE" | tail -n +1)

System Information:
- Memory: $(free -h | grep Mem | awk '{print $2}') total, $(free -h | grep Mem | awk '{print $3}') used
- Disk: $(df -h / | awk 'NR==2{print $2}') total, $(df -h / | awk 'NR==2{print $3}') used
- Load: $(uptime | awk -F'load average:' '{print $2}')

Network Configuration:
$(ip addr show | grep inet | head -5)

Running Processes:
$(ps aux | grep -E "(kea|bind|nginx|postgres|sagaos)" | grep -v grep)

EOF
    
    log_test "PASS" "Report Generation" "Report saved to $report_file"
    echo -e "${BLUE}📄 Full report: $report_file${NC}"
}

# Function to display final summary
display_summary() {
    echo ""
    echo -e "${CYAN}🏁 Validation Summary${NC}"
    echo -e "${BLUE}===================${NC}"
    echo ""
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"
    echo -e "${YELLOW}⏭️  Skipped: $SKIPPED_TESTS${NC}"
    echo -e "${BLUE}📊 Total: $TOTAL_TESTS${NC}"
    echo ""
    
    local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo -e "${CYAN}Success Rate: ${success_rate}%${NC}"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}🎉 All validations passed! SagaOS is ready for use.${NC}"
        return 0
    elif [ "$FAILED_TESTS" -lt 3 ]; then
        echo -e "${YELLOW}⚠️  Some validations failed, but core functionality appears intact.${NC}"
        return 1
    else
        echo -e "${RED}🚨 Multiple validations failed. Please review the installation.${NC}"
        return 2
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        --skip-installation)
            VALIDATE_INSTALLATION=false
            shift
            ;;
        --skip-configuration)
            VALIDATE_CONFIGURATION=false
            shift
            ;;
        --skip-functionality)
            VALIDATE_FUNCTIONALITY=false
            shift
            ;;
        --skip-security)
            VALIDATE_SECURITY=false
            shift
            ;;
        --skip-performance)
            VALIDATE_PERFORMANCE=false
            shift
            ;;
        --no-report)
            GENERATE_REPORT=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            log_test "FAIL" "Arguments" "Unknown option: $1"
            usage
            exit 3
            ;;
    esac
done

# Main execution
main() {
    echo -e "${GREEN}🔍 Starting SagaOS installation validation...${NC}"
    echo ""
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Run validation categories
    validate_installation
    validate_configuration
    validate_functionality
    validate_security
    validate_performance
    
    # Generate report
    generate_report
    
    # Display final summary
    display_summary
}

# Run main function
main "$@"
