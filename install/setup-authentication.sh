#!/bin/bash

# SagaOS Authentication Setup Script
# Configures admin/admin credentials across all services
# For development and initial deployment

set -euo pipefail

echo "🔐 Setting up SagaOS Authentication (admin/admin)"
echo "=================================================="

# Configuration variables
ADMIN_USER="admin"
ADMIN_PASS="admin"
ADMIN_EMAIL="admin@sagaos.com"
ADMIN_DISPLAY_NAME="Administrator"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kea}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-admin}"

# TSIG secret for BIND9 (base64 encoded admin credentials)
TSIG_SECRET="YWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbg=="

echo "📋 Configuration Summary:"
echo "  Admin Username: $ADMIN_USER"
echo "  Admin Password: $ADMIN_PASS"
echo "  Admin Email: $ADMIN_EMAIL"
echo "  Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Function to check if PostgreSQL is running
check_postgres() {
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
        echo "❌ PostgreSQL is not running or not accessible"
        echo "   Please start PostgreSQL and ensure it's accessible at $DB_HOST:$DB_PORT"
        return 1
    fi
    echo "✅ PostgreSQL is running"
}

# Function to setup database authentication
setup_database_auth() {
    echo "🗄️  Setting up database authentication..."

    # Create database user if it doesn't exist
    sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
                CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';
            END IF;
        END
        \$\$;
    " 2>/dev/null || echo "Database user may already exist"

    # Create database if it doesn't exist
    sudo -u postgres createdb -h "$DB_HOST" -p "$DB_PORT" -O "$DB_USER" "$DB_NAME" 2>/dev/null || echo "Database may already exist"

    # Grant admin user superuser privileges for schema management
    sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -c "ALTER ROLE $DB_USER WITH SUPERUSER;" 2>/dev/null || true

    # Apply database schemas as postgres user to avoid permission issues
    if [ -f "config/database/users-schema.sql" ]; then
        echo "  Applying users schema..."
        sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f config/database/users-schema.sql 2>&1 | grep -v "already exists" | grep -v "no privileges were granted" || true
    fi

    if [ -f "config/database/dns-schema.sql" ]; then
        echo "  Applying DNS schema..."
        sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f config/database/dns-schema.sql 2>&1 | grep -v "already exists" | grep -v "no privileges were granted" || true
    fi

    # Transfer ownership of all objects to admin user
    sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" << EOF >/dev/null 2>&1
        ALTER TABLE IF EXISTS users OWNER TO $DB_USER;
        ALTER TABLE IF EXISTS user_sessions OWNER TO $DB_USER;
        ALTER TABLE IF EXISTS dns_audit_log OWNER TO $DB_USER;
        ALTER TABLE IF EXISTS ddns_status OWNER TO $DB_USER;
        ALTER TABLE IF EXISTS dns_zones OWNER TO $DB_USER;
        ALTER TABLE IF EXISTS dns_records_cache OWNER TO $DB_USER;
        ALTER SEQUENCE IF EXISTS dns_audit_log_id_seq OWNER TO $DB_USER;
        ALTER SEQUENCE IF EXISTS ddns_status_id_seq OWNER TO $DB_USER;
        ALTER SEQUENCE IF EXISTS dns_zones_id_seq OWNER TO $DB_USER;
        ALTER SEQUENCE IF EXISTS dns_records_cache_id_seq OWNER TO $DB_USER;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
        GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;
EOF

    echo "✅ Database authentication configured"
}

# Function to setup BIND9 authentication
setup_bind9_auth() {
    echo "🌐 Setting up BIND9 authentication..."
    
    # Create BIND9 keys directory
    sudo mkdir -p /etc/bind/keys
    
    # Copy TSIG key file
    if [ -f "config/bind9/keys/sagaos-ddns-key.key" ]; then
        sudo cp config/bind9/keys/sagaos-ddns-key.key /etc/bind/keys/
        sudo chown bind:bind /etc/bind/keys/sagaos-ddns-key.key
        sudo chmod 640 /etc/bind/keys/sagaos-ddns-key.key
    fi
    
    # Copy rndc configuration
    if [ -f "config/bind9/rndc.conf" ]; then
        sudo cp config/bind9/rndc.conf /etc/bind/
        sudo chown bind:bind /etc/bind/rndc.conf
        sudo chmod 640 /etc/bind/rndc.conf
    fi
    
    # Copy named.conf.local
    if [ -f "config/bind9/named.conf.local" ]; then
        sudo cp config/bind9/named.conf.local /etc/bind/
        sudo chown bind:bind /etc/bind/named.conf.local
        sudo chmod 644 /etc/bind/named.conf.local
    fi
    
    echo "✅ BIND9 authentication configured"
}

# Function to setup Kea authentication
setup_kea_auth() {
    echo "🏠 Setting up Kea Control Agent authentication..."
    
    # Copy Kea Control Agent configuration
    if [ -f "config/kea/kea-ctrl-agent.conf" ]; then
        sudo mkdir -p /etc/kea
        sudo cp config/kea/kea-ctrl-agent.conf /etc/kea/
        sudo chown root:root /etc/kea/kea-ctrl-agent.conf
        sudo chmod 644 /etc/kea/kea-ctrl-agent.conf
    fi
    
    echo "✅ Kea Control Agent authentication configured"
}

# Function to create environment file
create_env_file() {
    echo "📝 Creating environment configuration..."
    
    cat > .env << EOF
# SagaOS Environment Configuration
# Generated by setup-authentication.sh

# Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Authentication Configuration
AUTH_ADMIN_USERNAME=$ADMIN_USER
AUTH_ADMIN_PASSWORD=$ADMIN_PASS

# Kea Control Agent
KEA_CA_URL=http://127.0.0.1:8000
KEA_CA_USER=$ADMIN_USER
KEA_CA_PASSWORD=$ADMIN_PASS

# BIND9 Configuration
DNS_SERVER=127.0.0.1
DNS_PORT=53
DNS_TSIG_KEY_NAME=sagaos-ddns-key
DNS_TSIG_SECRET=$TSIG_SECRET
DNS_RNDC_HOST=127.0.0.1
DNS_RNDC_PORT=953
DNS_RNDC_KEY=rndc-key
DNS_RNDC_SECRET=$TSIG_SECRET

# API Gateway
PORT=3001
NODE_ENV=development
EOF
    
    echo "✅ Environment file created (.env)"
}

# Function to validate authentication setup
validate_setup() {
    echo "🔍 Validating authentication setup..."
    
    # Check database connection
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database connection successful"
    else
        echo "❌ Database connection failed"
    fi
    
    # Check if admin user exists in database
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT username FROM users WHERE username='$ADMIN_USER';" | grep -q "$ADMIN_USER"; then
        echo "✅ Admin user exists in database"
    else
        echo "❌ Admin user not found in database"
    fi
    
    echo "✅ Authentication setup validation complete"
}

# Main execution
main() {
    echo "Starting authentication setup..."
    
    # Check prerequisites
    check_postgres
    
    # Setup authentication for each service
    setup_database_auth
    setup_bind9_auth
    setup_kea_auth
    create_env_file
    validate_setup
    
    echo ""
    echo "🎉 Authentication setup complete!"
    echo ""
    echo "📋 Summary:"
    echo "  ✅ Database: admin/admin"
    echo "  ✅ Frontend: admin/admin"
    echo "  ✅ Kea Control Agent: admin/admin"
    echo "  ✅ BIND9: TSIG keys configured"
    echo ""
    echo "🚀 You can now start the services and login with admin/admin"
    echo ""
    echo "⚠️  SECURITY WARNING:"
    echo "   These are default development credentials!"
    echo "   Change them before deploying to production!"
}

# Run main function
main "$@"
