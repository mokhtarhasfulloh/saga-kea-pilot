#!/bin/bash

# SagaOS Secret Management System
# Handles secrets for development, staging, and production environments
# Provides secure generation, validation, and rotation of secrets

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="$PROJECT_ROOT/.secrets"
ENV_FILE="$PROJECT_ROOT/.env"

echo "🔐 SagaOS Secret Management System"
echo "=================================="

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Manage secrets for SagaOS across different environments.

COMMANDS:
    generate        Generate new secrets for specified environment
    validate        Validate existing secrets
    rotate          Rotate existing secrets
    backup          Backup current secrets
    restore         Restore secrets from backup
    clean           Clean up temporary secret files

OPTIONS:
    -e, --env ENV           Environment (development|staging|production)
    -f, --force             Force operation without confirmation
    -b, --backup-dir DIR    Backup directory (default: .secrets/backups)
    -h, --help              Show this help message

EXAMPLES:
    $0 generate --env development    # Generate dev secrets
    $0 generate --env production     # Generate production secrets
    $0 validate --env staging        # Validate staging secrets
    $0 rotate --env production       # Rotate production secrets
    $0 backup                        # Backup current secrets

EOF
}

# Function to generate strong password
generate_password() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "\n"
}

# Function to generate TSIG secret
generate_tsig_secret() {
    openssl rand -base64 32 | tr -d "\n"
}

# Function to generate database password
generate_db_password() {
    # Generate a strong password with special characters
    openssl rand -base64 24 | tr -d "=+/" | head -c 24
}

# Function to create secrets directory
create_secrets_dir() {
    mkdir -p "$SECRETS_DIR"/{development,staging,production,backups}
    chmod 700 "$SECRETS_DIR"
    
    # Create .gitignore for secrets directory
    cat > "$SECRETS_DIR/.gitignore" << EOF
# Never commit secrets to version control
*
!.gitignore
EOF
}

# Function to generate development secrets
generate_development_secrets() {
    echo "🔧 Generating development secrets..."
    
    local secrets_file="$SECRETS_DIR/development/secrets.env"
    
    cat > "$secrets_file" << EOF
# SagaOS Development Secrets
# Generated on: $(date)
# Environment: Development

# JWT Secret (weak for development)
JWT_SECRET=dev-jwt-secret-not-for-production

# Database Password (simple for development)
DB_PASSWORD=admin

# Admin Password (simple for development)
AUTH_ADMIN_PASSWORD=admin

# Kea Control Agent Password (simple for development)
KEA_CA_PASSWORD=admin

# TSIG Secrets (predictable for development)
DNS_TSIG_SECRET=YWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbg==
DNS_RNDC_SECRET=YWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbmFkbWluYWRtaW5hZG1pbg==
EOF
    
    chmod 600 "$secrets_file"
    echo "✅ Development secrets generated: $secrets_file"
}

# Function to generate staging secrets
generate_staging_secrets() {
    echo "🧪 Generating staging secrets..."
    
    local secrets_file="$SECRETS_DIR/staging/secrets.env"
    local jwt_secret=$(generate_jwt_secret)
    local db_password=$(generate_db_password)
    local admin_password=$(generate_password 16)
    local kea_password=$(generate_password 16)
    local tsig_secret=$(generate_tsig_secret)
    local rndc_secret=$(generate_tsig_secret)
    
    cat > "$secrets_file" << EOF
# SagaOS Staging Secrets
# Generated on: $(date)
# Environment: Staging

# JWT Secret (strong for staging)
JWT_SECRET=$jwt_secret

# Database Password (strong for staging)
DB_PASSWORD=$db_password

# Admin Password (strong for staging)
AUTH_ADMIN_PASSWORD=$admin_password

# Kea Control Agent Password (strong for staging)
KEA_CA_PASSWORD=$kea_password

# TSIG Secrets (unique for staging)
DNS_TSIG_SECRET=$tsig_secret
DNS_RNDC_SECRET=$rndc_secret
EOF
    
    chmod 600 "$secrets_file"
    echo "✅ Staging secrets generated: $secrets_file"
    
    # Display secrets for manual configuration
    echo ""
    echo "📋 Staging Secrets Summary:"
    echo "  Database Password: $db_password"
    echo "  Admin Password: $admin_password"
    echo "  Kea Password: $kea_password"
    echo ""
    echo "⚠️  Save these secrets securely!"
}

# Function to generate production secrets
generate_production_secrets() {
    echo "🚀 Generating production secrets..."
    
    local secrets_file="$SECRETS_DIR/production/secrets.env"
    local jwt_secret=$(generate_jwt_secret)
    local db_password=$(generate_password 32)
    local admin_password=$(generate_password 24)
    local kea_password=$(generate_password 24)
    local tsig_secret=$(generate_tsig_secret)
    local rndc_secret=$(generate_tsig_secret)
    
    cat > "$secrets_file" << EOF
# SagaOS Production Secrets
# Generated on: $(date)
# Environment: Production

# JWT Secret (maximum strength for production)
JWT_SECRET=$jwt_secret

# Database Password (maximum strength for production)
DB_PASSWORD=$db_password

# Admin Password (maximum strength for production)
AUTH_ADMIN_PASSWORD=$admin_password

# Kea Control Agent Password (maximum strength for production)
KEA_CA_PASSWORD=$kea_password

# TSIG Secrets (unique for production)
DNS_TSIG_SECRET=$tsig_secret
DNS_RNDC_SECRET=$rndc_secret
EOF
    
    chmod 600 "$secrets_file"
    echo "✅ Production secrets generated: $secrets_file"
    
    # Display secrets for manual configuration
    echo ""
    echo "📋 Production Secrets Summary:"
    echo "  Database Password: $db_password"
    echo "  Admin Password: $admin_password"
    echo "  Kea Password: $kea_password"
    echo ""
    echo "🚨 CRITICAL: Save these secrets in a secure password manager!"
    echo "🚨 These secrets will not be displayed again!"
}

# Function to validate secrets
validate_secrets() {
    local env="$1"
    local secrets_file="$SECRETS_DIR/$env/secrets.env"
    
    echo "🔍 Validating $env secrets..."
    
    if [ ! -f "$secrets_file" ]; then
        echo "❌ Secrets file not found: $secrets_file"
        return 1
    fi
    
    # Source the secrets file
    source "$secrets_file"
    
    local validation_errors=0
    
    # Validate JWT secret
    if [ -z "${JWT_SECRET:-}" ] || [ ${#JWT_SECRET} -lt 32 ]; then
        echo "❌ JWT_SECRET is missing or too short (minimum 32 characters)"
        ((validation_errors++))
    fi
    
    # Validate database password
    if [ -z "${DB_PASSWORD:-}" ]; then
        echo "❌ DB_PASSWORD is missing"
        ((validation_errors++))
    elif [ "$env" = "production" ] && [ ${#DB_PASSWORD} -lt 16 ]; then
        echo "❌ DB_PASSWORD is too short for production (minimum 16 characters)"
        ((validation_errors++))
    fi
    
    # Validate admin password
    if [ -z "${AUTH_ADMIN_PASSWORD:-}" ]; then
        echo "❌ AUTH_ADMIN_PASSWORD is missing"
        ((validation_errors++))
    elif [ "$env" = "production" ] && [ ${#AUTH_ADMIN_PASSWORD} -lt 12 ]; then
        echo "❌ AUTH_ADMIN_PASSWORD is too short for production (minimum 12 characters)"
        ((validation_errors++))
    fi
    
    # Check for default development passwords in non-dev environments
    if [ "$env" != "development" ]; then
        if [ "${AUTH_ADMIN_PASSWORD:-}" = "admin" ]; then
            echo "❌ Default admin password detected in $env environment"
            ((validation_errors++))
        fi
        if [ "${DB_PASSWORD:-}" = "admin" ]; then
            echo "❌ Default database password detected in $env environment"
            ((validation_errors++))
        fi
    fi
    
    if [ $validation_errors -eq 0 ]; then
        echo "✅ All secrets are valid for $env environment"
        return 0
    else
        echo "❌ $validation_errors validation error(s) found"
        return 1
    fi
}

# Function to backup secrets
backup_secrets() {
    local backup_dir="$SECRETS_DIR/backups/$(date +%Y%m%d-%H%M%S)"
    
    echo "💾 Backing up secrets..."
    
    mkdir -p "$backup_dir"
    
    # Copy all environment secrets
    for env in development staging production; do
        if [ -d "$SECRETS_DIR/$env" ]; then
            cp -r "$SECRETS_DIR/$env" "$backup_dir/"
            echo "  ✅ Backed up $env secrets"
        fi
    done
    
    echo "✅ Secrets backed up to: $backup_dir"
}

# Function to apply secrets to environment file
apply_secrets() {
    local env="$1"
    local secrets_file="$SECRETS_DIR/$env/secrets.env"
    local target_env_file="$PROJECT_ROOT/.env.$env"
    
    if [ ! -f "$secrets_file" ]; then
        echo "❌ Secrets file not found: $secrets_file"
        return 1
    fi
    
    if [ ! -f "$target_env_file" ]; then
        echo "❌ Environment file not found: $target_env_file"
        return 1
    fi
    
    echo "🔧 Applying $env secrets to environment file..."
    
    # Source the secrets
    source "$secrets_file"
    
    # Update environment file with secrets
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$target_env_file"
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" "$target_env_file"
    sed -i "s/AUTH_ADMIN_PASSWORD=.*/AUTH_ADMIN_PASSWORD=$AUTH_ADMIN_PASSWORD/" "$target_env_file"
    sed -i "s/KEA_CA_PASSWORD=.*/KEA_CA_PASSWORD=$KEA_CA_PASSWORD/" "$target_env_file"
    sed -i "s/DNS_TSIG_SECRET=.*/DNS_TSIG_SECRET=$DNS_TSIG_SECRET/" "$target_env_file"
    sed -i "s/DNS_RNDC_SECRET=.*/DNS_RNDC_SECRET=$DNS_RNDC_SECRET/" "$target_env_file"
    
    echo "✅ Secrets applied to $target_env_file"
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT=""
FORCE=false
BACKUP_DIR="$SECRETS_DIR/backups"

while [[ $# -gt 0 ]]; do
    case $1 in
        generate|validate|rotate|backup|restore|clean)
            COMMAND="$1"
            shift
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -b|--backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment parameter for commands that need it
if [[ "$COMMAND" =~ ^(generate|validate|rotate)$ ]] && [ -z "$ENVIRONMENT" ]; then
    echo "❌ Environment is required for $COMMAND command"
    echo "Use: $0 $COMMAND --env [development|staging|production]"
    exit 1
fi

# Validate environment value
if [ -n "$ENVIRONMENT" ] && [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Valid environments: development, staging, production"
    exit 1
fi

# Main execution
main() {
    # Create secrets directory if it doesn't exist
    create_secrets_dir
    
    case "$COMMAND" in
        generate)
            case "$ENVIRONMENT" in
                development)
                    generate_development_secrets
                    ;;
                staging)
                    generate_staging_secrets
                    ;;
                production)
                    generate_production_secrets
                    ;;
            esac
            apply_secrets "$ENVIRONMENT"
            ;;
        validate)
            validate_secrets "$ENVIRONMENT"
            ;;
        backup)
            backup_secrets
            ;;
        *)
            echo "❌ Unknown command: $COMMAND"
            usage
            exit 1
            ;;
    esac
}

# Run main function if command is provided
if [ -n "$COMMAND" ]; then
    main "$@"
else
    usage
fi
