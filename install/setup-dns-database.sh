#!/bin/bash

# Setup DNS Database Schema for SagaOS
# This script creates the DNS audit and management tables in PostgreSQL

set -e

echo "=== Setting up DNS Database Schema ==="

# Check if running as root or kea user
if [[ $EUID -eq 0 ]]; then
    echo "Running as root - will use sudo for database operations"
    DB_USER="sudo -u kea"
elif [[ $(whoami) == "kea" ]]; then
    echo "Running as kea user"
    DB_USER=""
else
    echo "This script should be run as root or kea user"
    exit 1
fi

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo "Error: PostgreSQL is not running"
    echo "Please start PostgreSQL: sudo systemctl start postgresql"
    exit 1
fi

# Check if kea database exists
if ! $DB_USER psql -d kea -c "SELECT 1;" >/dev/null 2>&1; then
    echo "Error: Cannot connect to kea database"
    echo "Please ensure the kea database is set up and accessible"
    exit 1
fi

echo "Connected to kea database successfully"

# Apply DNS schema
echo "Creating DNS tables and functions..."
$DB_USER psql -d kea -f config/database/dns-schema.sql

if [[ $? -eq 0 ]]; then
    echo "DNS schema created successfully"
else
    echo "Error: Failed to create DNS schema"
    exit 1
fi

# Verify tables were created
echo "Verifying DNS tables..."
TABLES=$($DB_USER psql -d kea -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'dns_%' ORDER BY table_name;")

echo "Created DNS tables:"
echo "$TABLES"

# Check if all expected tables exist
EXPECTED_TABLES=("dns_audit_log" "dns_zones" "dns_records_cache" "ddns_status")
for table in "${EXPECTED_TABLES[@]}"; do
    if echo "$TABLES" | grep -q "$table"; then
        echo "✓ $table"
    else
        echo "✗ $table - MISSING"
        exit 1
    fi
done

# Test the logging function
echo "Testing DNS logging function..."
$DB_USER psql -d kea -c "SELECT log_dns_operation(
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'CREATE',
    'lan.sagaos.local',
    'test',
    'A',
    NULL,
    '10.0.0.100',
    300,
    NULL,
    NULL,
    NULL,
    true,
    NULL,
    '127.0.0.1'::inet,
    'SagaOS-Setup'
);"

# Verify the test log entry
LOG_COUNT=$($DB_USER psql -d kea -t -c "SELECT COUNT(*) FROM dns_audit_log WHERE record_name = 'test';")
if [[ $LOG_COUNT -gt 0 ]]; then
    echo "✓ DNS logging function working"
    # Clean up test entry
    $DB_USER psql -d kea -c "DELETE FROM dns_audit_log WHERE record_name = 'test';"
else
    echo "✗ DNS logging function failed"
    exit 1
fi

# Test the DDNS status function
echo "Testing DDNS status function..."
$DB_USER psql -d kea -c "SELECT update_ddns_status(
    '00000000-0000-0000-0000-000000000000'::uuid,
    'lan.sagaos.local',
    'HEALTHY',
    NULL,
    true
);"

# Verify the DDNS status entry
STATUS_COUNT=$($DB_USER psql -d kea -t -c "SELECT COUNT(*) FROM ddns_status WHERE zone_name = 'lan.sagaos.local';")
if [[ $STATUS_COUNT -gt 0 ]]; then
    echo "✓ DDNS status function working"
else
    echo "✗ DDNS status function failed"
    exit 1
fi

# Show current DNS zones
echo "Current DNS zones in database:"
$DB_USER psql -d kea -c "SELECT name, type, status, allow_updates, tsig_key_name FROM dns_zones ORDER BY name;"

echo ""
echo "=== DNS Database Schema Setup Complete ==="
echo "Tables created:"
echo "  - dns_audit_log: Tracks all DNS operations"
echo "  - dns_zones: Zone configuration and metadata"
echo "  - dns_records_cache: Optional record caching"
echo "  - ddns_status: DDNS health and status tracking"
echo ""
echo "Functions created:"
echo "  - log_dns_operation(): Log DNS changes"
echo "  - update_ddns_status(): Update DDNS status"
echo ""
echo "Default zones configured:"
echo "  - lan.sagaos.local (forward zone)"
echo "  - 0.10.in-addr.arpa (reverse zone)"
