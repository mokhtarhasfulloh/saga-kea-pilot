-- DNS Audit and Management Schema for SagaOS
-- This schema provides audit logging and status tracking for DNS operations

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DNS Audit Log Table
-- Tracks all DNS record changes with user attribution
CREATE TABLE IF NOT EXISTS dns_audit_log (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'RELOAD')),
    zone_name VARCHAR(255) NOT NULL,
    record_name VARCHAR(255),
    record_type VARCHAR(10) CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT', 'CAA')),
    old_value TEXT,
    new_value TEXT,
    ttl INTEGER,
    priority INTEGER,
    weight INTEGER,
    port INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT dns_audit_log_zone_name_idx CHECK (length(zone_name) > 0),
    CONSTRAINT dns_audit_log_action_valid CHECK (action IS NOT NULL)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dns_audit_log_tenant_id ON dns_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_audit_log_user_id ON dns_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dns_audit_log_zone_name ON dns_audit_log(zone_name);
CREATE INDEX IF NOT EXISTS idx_dns_audit_log_timestamp ON dns_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dns_audit_log_action ON dns_audit_log(action);

-- DDNS Status Tracking Table
-- Tracks the status and health of DDNS operations
CREATE TABLE IF NOT EXISTS ddns_status (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    zone_name VARCHAR(255) NOT NULL,
    last_update TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('HEALTHY', 'WARNING', 'ERROR', 'UNKNOWN')) DEFAULT 'UNKNOWN',
    error_message TEXT,
    update_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_success TIMESTAMP WITH TIME ZONE,
    last_failure TIMESTAMP WITH TIME ZONE,
    d2_daemon_status VARCHAR(20) DEFAULT 'UNKNOWN',
    bind_status VARCHAR(20) DEFAULT 'UNKNOWN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique zone per tenant
    UNIQUE(tenant_id, zone_name)
);

-- Create indexes for DDNS status
CREATE INDEX IF NOT EXISTS idx_ddns_status_tenant_id ON ddns_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ddns_status_zone_name ON ddns_status(zone_name);
CREATE INDEX IF NOT EXISTS idx_ddns_status_status ON ddns_status(status);
CREATE INDEX IF NOT EXISTS idx_ddns_status_updated_at ON ddns_status(updated_at DESC);

-- DNS Zone Configuration Table
-- Stores zone configuration and metadata
CREATE TABLE IF NOT EXISTS dns_zones (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('master', 'slave', 'forward')) DEFAULT 'master',
    file_path VARCHAR(500),
    serial_number BIGINT,
    refresh_interval INTEGER DEFAULT 3600,
    retry_interval INTEGER DEFAULT 1800,
    expire_interval INTEGER DEFAULT 604800,
    minimum_ttl INTEGER DEFAULT 86400,
    primary_ns VARCHAR(255),
    admin_email VARCHAR(255),
    allow_updates BOOLEAN DEFAULT false,
    tsig_key_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ERROR')),
    last_validated TIMESTAMP WITH TIME ZONE,
    validation_errors TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique zone names per tenant
    UNIQUE(tenant_id, name)
);

-- Create indexes for DNS zones
CREATE INDEX IF NOT EXISTS idx_dns_zones_tenant_id ON dns_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_zones_name ON dns_zones(name);
CREATE INDEX IF NOT EXISTS idx_dns_zones_type ON dns_zones(type);
CREATE INDEX IF NOT EXISTS idx_dns_zones_status ON dns_zones(status);

-- DNS Records Cache Table (optional - for performance)
-- Caches DNS records for faster API responses
CREATE TABLE IF NOT EXISTS dns_records_cache (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    zone_name VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    ttl INTEGER DEFAULT 300,
    priority INTEGER,
    weight INTEGER,
    port INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique records
    UNIQUE(tenant_id, zone_name, name, type)
);

-- Create indexes for DNS records cache
CREATE INDEX IF NOT EXISTS idx_dns_records_cache_tenant_id ON dns_records_cache(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_cache_zone_name ON dns_records_cache(zone_name);
CREATE INDEX IF NOT EXISTS idx_dns_records_cache_name ON dns_records_cache(name);
CREATE INDEX IF NOT EXISTS idx_dns_records_cache_type ON dns_records_cache(type);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at columns
CREATE TRIGGER update_ddns_status_updated_at 
    BEFORE UPDATE ON ddns_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dns_zones_updated_at 
    BEFORE UPDATE ON dns_zones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log DNS operations
CREATE OR REPLACE FUNCTION log_dns_operation(
    p_tenant_id UUID,
    p_user_id UUID,
    p_action VARCHAR(50),
    p_zone_name VARCHAR(255),
    p_record_name VARCHAR(255) DEFAULT NULL,
    p_record_type VARCHAR(10) DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_ttl INTEGER DEFAULT NULL,
    p_priority INTEGER DEFAULT NULL,
    p_weight INTEGER DEFAULT NULL,
    p_port INTEGER DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO dns_audit_log (
        tenant_id, user_id, action, zone_name, record_name, record_type,
        old_value, new_value, ttl, priority, weight, port,
        success, error_message, ip_address, user_agent
    ) VALUES (
        p_tenant_id, p_user_id, p_action, p_zone_name, p_record_name, p_record_type,
        p_old_value, p_new_value, p_ttl, p_priority, p_weight, p_port,
        p_success, p_error_message, p_ip_address, p_user_agent
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update DDNS status
CREATE OR REPLACE FUNCTION update_ddns_status(
    p_tenant_id UUID,
    p_zone_name VARCHAR(255),
    p_status VARCHAR(20),
    p_error_message TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true
) RETURNS VOID AS $$
BEGIN
    INSERT INTO ddns_status (tenant_id, zone_name, status, error_message, update_count, success_count, failure_count, last_update)
    VALUES (p_tenant_id, p_zone_name, p_status, p_error_message, 1, 
            CASE WHEN p_success THEN 1 ELSE 0 END,
            CASE WHEN p_success THEN 0 ELSE 1 END,
            NOW())
    ON CONFLICT (tenant_id, zone_name) DO UPDATE SET
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        update_count = ddns_status.update_count + 1,
        success_count = ddns_status.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
        failure_count = ddns_status.failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
        last_update = NOW(),
        last_success = CASE WHEN p_success THEN NOW() ELSE ddns_status.last_success END,
        last_failure = CASE WHEN p_success THEN ddns_status.last_failure ELSE NOW() END;
END;
$$ LANGUAGE plpgsql;

-- Insert default tenant and admin user if they don't exist
INSERT INTO dns_zones (tenant_id, name, type, primary_ns, admin_email, allow_updates, tsig_key_name)
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'lan.sagaos.local', 'master', 'ns1.lan.sagaos.local', 'admin@lan.sagaos.local', true, 'sagaos-ddns-key'),
    ('00000000-0000-0000-0000-000000000000', '0.10.in-addr.arpa', 'master', 'ns1.lan.sagaos.local', 'admin@lan.sagaos.local', true, 'sagaos-ddns-key')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Grant permissions to admin user
GRANT SELECT, INSERT, UPDATE, DELETE ON dns_audit_log TO admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ddns_status TO admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON dns_zones TO admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON dns_records_cache TO admin;
GRANT USAGE ON SEQUENCE dns_audit_log_id_seq TO admin;
GRANT USAGE ON SEQUENCE ddns_status_id_seq TO admin;
GRANT USAGE ON SEQUENCE dns_zones_id_seq TO admin;
GRANT USAGE ON SEQUENCE dns_records_cache_id_seq TO admin;
