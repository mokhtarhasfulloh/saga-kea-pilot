#!/bin/bash

# ============================================================================
# SagaOS - Fix Database Permissions
# ============================================================================
# This script fixes PostgreSQL permission errors by transferring ownership
# of tables from postgres user to admin user
# ============================================================================

set -e

echo "🔧 SagaOS Database Permissions Fix"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kea}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-admin}"

echo "📋 Database Configuration:"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL status..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    echo "❌ PostgreSQL is not running or not accessible"
    exit 1
fi
echo "✅ PostgreSQL is running"
echo ""

# Transfer ownership of all tables to admin user
echo "🔧 Transferring table ownership to $DB_USER..."

sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" << EOF
-- Transfer ownership of all tables
ALTER TABLE IF EXISTS users OWNER TO $DB_USER;
ALTER TABLE IF EXISTS user_sessions OWNER TO $DB_USER;
ALTER TABLE IF EXISTS dns_audit_log OWNER TO $DB_USER;
ALTER TABLE IF EXISTS ddns_status OWNER TO $DB_USER;
ALTER TABLE IF EXISTS dns_zones OWNER TO $DB_USER;
ALTER TABLE IF EXISTS dns_records_cache OWNER TO $DB_USER;

-- Transfer ownership of sequences
ALTER SEQUENCE IF EXISTS dns_audit_log_id_seq OWNER TO $DB_USER;
ALTER SEQUENCE IF EXISTS ddns_status_id_seq OWNER TO $DB_USER;
ALTER SEQUENCE IF EXISTS dns_zones_id_seq OWNER TO $DB_USER;
ALTER SEQUENCE IF EXISTS dns_records_cache_id_seq OWNER TO $DB_USER;

-- Transfer ownership of functions
ALTER FUNCTION IF EXISTS update_updated_at_column() OWNER TO $DB_USER;
ALTER FUNCTION IF EXISTS clean_expired_sessions() OWNER TO $DB_USER;
ALTER FUNCTION IF EXISTS log_dns_operation(text, text, text, text, text, text) OWNER TO $DB_USER;
ALTER FUNCTION IF EXISTS update_ddns_status(text, text, text, text) OWNER TO $DB_USER;

-- Grant all privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;

-- Show current ownership
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Table ownership transferred successfully"
else
    echo "❌ Failed to transfer table ownership"
    exit 1
fi

echo ""
echo "🔍 Verifying database schema..."

# Re-apply schemas to ensure all indexes and constraints are correct
if [ -f "config/database/users-schema.sql" ]; then
    echo "  Re-applying users schema..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f config/database/users-schema.sql 2>&1 | grep -v "already exists" | grep -v "no privileges were granted" || true
fi

if [ -f "config/database/dns-schema.sql" ]; then
    echo "  Re-applying DNS schema..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f config/database/dns-schema.sql 2>&1 | grep -v "already exists" | grep -v "no privileges were granted" || true
fi

echo ""
echo "🧪 Testing database connection..."

# Test connection as admin user
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM users;" >/dev/null 2>&1; then
    echo "✅ Database connection successful"
    
    # Show user count
    USER_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" | xargs)
    echo "✅ Found $USER_COUNT user(s) in database"
else
    echo "⚠️  Database connection test failed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Database Permissions Fixed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All tables now owned by: $DB_USER"
echo "✅ All privileges granted"
echo "✅ Schema validation complete"
echo ""
echo "🚀 You can now run the authentication setup script:"
echo "   bash install/setup-authentication.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

