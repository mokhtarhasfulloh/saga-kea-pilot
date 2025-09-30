-- DNS Management Database Schema for SagaOS
-- PostgreSQL migration for DNS zone and record management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tenants table for multi-tenancy
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- Create DNS zones table
CREATE TABLE IF NOT EXISTS dns_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'master',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    primary_ns VARCHAR(255),
    admin_email VARCHAR(255),
    serial BIGINT DEFAULT 1,
    refresh_interval INTEGER DEFAULT 3600,
    retry_interval INTEGER DEFAULT 1800,
    expire_interval INTEGER DEFAULT 604800,
    minimum_ttl INTEGER DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(tenant_id, name)
);

-- Create DNS records table
CREATE TABLE IF NOT EXISTS dns_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    ttl INTEGER DEFAULT 300,
    priority INTEGER,
    weight INTEGER,
    port INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create TSIG keys table
CREATE TABLE IF NOT EXISTS tsig_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'hmac-sha256',
    secret TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    last_used TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    UNIQUE(tenant_id, name)
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    operation VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    source_ip INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create DNS query logs table (for monitoring)
CREATE TABLE IF NOT EXISTS dns_query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_ip INET NOT NULL,
    query_name VARCHAR(255) NOT NULL,
    query_type VARCHAR(10) NOT NULL,
    response_code VARCHAR(20) NOT NULL,
    response_time INTEGER, -- milliseconds
    recursive BOOLEAN DEFAULT false,
    cached BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create DDNS update history table
CREATE TABLE IF NOT EXISTS ddns_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
    record_name VARCHAR(255) NOT NULL,
    record_type VARCHAR(10) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    ttl INTEGER,
    source_ip INET,
    tsig_key_id UUID REFERENCES tsig_keys(id),
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create zone templates table
CREATE TABLE IF NOT EXISTS zone_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for global templates
    name VARCHAR(255) NOT NULL,
    description TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    records JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dns_zones_tenant_id ON dns_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_zones_name ON dns_zones(name);
CREATE INDEX IF NOT EXISTS idx_dns_zones_type ON dns_zones(type);

CREATE INDEX IF NOT EXISTS idx_dns_records_tenant_id ON dns_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_zone_id ON dns_records(zone_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_name ON dns_records(name);
CREATE INDEX IF NOT EXISTS idx_dns_records_type ON dns_records(type);
CREATE INDEX IF NOT EXISTS idx_dns_records_name_type ON dns_records(name, type);

CREATE INDEX IF NOT EXISTS idx_tsig_keys_tenant_id ON tsig_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tsig_keys_name ON tsig_keys(name);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_dns_query_logs_tenant_id ON dns_query_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_query_logs_client_ip ON dns_query_logs(client_ip);
CREATE INDEX IF NOT EXISTS idx_dns_query_logs_query_name ON dns_query_logs(query_name);
CREATE INDEX IF NOT EXISTS idx_dns_query_logs_created_at ON dns_query_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_ddns_updates_tenant_id ON ddns_updates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ddns_updates_zone_id ON ddns_updates(zone_id);
CREATE INDEX IF NOT EXISTS idx_ddns_updates_created_at ON ddns_updates(created_at);

-- Create Row Level Security (RLS) policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsig_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_query_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ddns_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (will be implemented based on current_setting('app.current_tenant_id'))
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_dns_zones ON dns_zones
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_dns_records ON dns_records
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_tsig_keys ON tsig_keys
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_dns_query_logs ON dns_query_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_ddns_updates ON ddns_updates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_zone_templates ON zone_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid OR is_public = true);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dns_zones_updated_at BEFORE UPDATE ON dns_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dns_records_updated_at BEFORE UPDATE ON dns_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tsig_keys_updated_at BEFORE UPDATE ON tsig_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zone_templates_updated_at BEFORE UPDATE ON zone_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically increment zone serial
CREATE OR REPLACE FUNCTION increment_zone_serial()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the zone serial when records are modified
    UPDATE dns_zones 
    SET serial = serial + 1, updated_at = NOW()
    WHERE id = COALESCE(NEW.zone_id, OLD.zone_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Create triggers for automatic zone serial increment
CREATE TRIGGER increment_serial_on_record_insert AFTER INSERT ON dns_records
    FOR EACH ROW EXECUTE FUNCTION increment_zone_serial();

CREATE TRIGGER increment_serial_on_record_update AFTER UPDATE ON dns_records
    FOR EACH ROW EXECUTE FUNCTION increment_zone_serial();

CREATE TRIGGER increment_serial_on_record_delete AFTER DELETE ON dns_records
    FOR EACH ROW EXECUTE FUNCTION increment_zone_serial();
