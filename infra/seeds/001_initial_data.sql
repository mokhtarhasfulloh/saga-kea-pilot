-- Initial seed data for SagaOS DNS Management System
-- This file populates the database with initial tenants, users, and sample DNS data

-- Insert default tenant
INSERT INTO tenants (id, name, domain, settings) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'Default Organization',
    'example.com',
    '{"timezone": "UTC", "dns_defaults": {"ttl": 300, "refresh": 3600}}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Insert default admin user
INSERT INTO users (id, tenant_id, email, name, role, permissions) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@example.com',
    'System Administrator',
    'admin',
    '["VIEW_RECORDS", "CREATE_RECORDS", "UPDATE_RECORDS", "DELETE_RECORDS", "MANAGE_ZONES", "MANAGE_USERS"]'::jsonb
) ON CONFLICT (tenant_id, email) DO NOTHING;

-- Insert sample DNS zones
INSERT INTO dns_zones (id, tenant_id, name, type, status, primary_ns, admin_email, created_by) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'example.com',
    'master',
    'active',
    'ns1.example.com',
    'admin@example.com',
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'test.local',
    'master',
    'active',
    'ns1.test.local',
    'admin@test.local',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (tenant_id, name) DO NOTHING;

-- Insert sample DNS records for example.com
INSERT INTO dns_records (tenant_id, zone_id, name, type, value, ttl, created_by) VALUES 
-- SOA record
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '@',
    'SOA',
    'ns1.example.com. admin.example.com. 2024010101 3600 1800 604800 300',
    300,
    '00000000-0000-0000-0000-000000000001'
),
-- NS records
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '@',
    'NS',
    'ns1.example.com.',
    300,
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '@',
    'NS',
    'ns2.example.com.',
    300,
    '00000000-0000-0000-0000-000000000001'
),
-- A records
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '@',
    'A',
    '192.168.1.100',
    300,
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'www',
    'A',
    '192.168.1.100',
    300,
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'mail',
    'A',
    '192.168.1.101',
    300,
    '00000000-0000-0000-0000-000000000001'
),
-- CNAME records
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'ftp',
    'CNAME',
    'www.example.com.',
    300,
    '00000000-0000-0000-0000-000000000001'
),
-- MX record
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '@',
    'MX',
    'mail.example.com.',
    300,
    '00000000-0000-0000-0000-000000000001'
),
-- TXT records
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '@',
    'TXT',
    'v=spf1 mx -all',
    300,
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '_dmarc',
    'TXT',
    'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com',
    300,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Update MX record with priority
UPDATE dns_records SET priority = 10 
WHERE zone_id = '00000000-0000-0000-0000-000000000001' 
AND name = '@' AND type = 'MX';

-- Insert sample DNS records for test.local
INSERT INTO dns_records (tenant_id, zone_id, name, type, value, ttl, created_by) VALUES 
-- SOA record
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '@',
    'SOA',
    'ns1.test.local. admin.test.local. 2024010101 3600 1800 604800 300',
    300,
    '00000000-0000-0000-0000-000000000001'
),
-- NS record
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '@',
    'NS',
    'ns1.test.local.',
    300,
    '00000000-0000-0000-0000-000000000001'
),
-- A records
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '@',
    'A',
    '10.0.0.100',
    300,
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'server1',
    'A',
    '10.0.0.101',
    300,
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'server2',
    'A',
    '10.0.0.102',
    300,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Insert sample TSIG keys
INSERT INTO tsig_keys (tenant_id, name, algorithm, secret, created_by) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'update-key',
    'hmac-sha256',
    'VGhpcyBpcyBhIHNhbXBsZSBUU0lHIGtleSBmb3IgdGVzdGluZw==',
    '00000000-0000-0000-0000-000000000001'
),
(
    '00000000-0000-0000-0000-000000000001',
    'transfer-key',
    'hmac-sha256',
    'QW5vdGhlciBzYW1wbGUgVFNJRyBrZXkgZm9yIHpvbmUgdHJhbnNmZXJz',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (tenant_id, name) DO NOTHING;

-- Insert sample zone templates
INSERT INTO zone_templates (tenant_id, name, description, variables, records, created_by) VALUES 
(
    NULL, -- Global template
    'Basic Web Server',
    'Standard web server zone with A, AAAA, and CNAME records',
    '["domain", "webserver_ip", "webserver_ipv6"]'::jsonb,
    '[
        {"name": "@", "type": "A", "value": "{{webserver_ip}}", "ttl": 300},
        {"name": "@", "type": "AAAA", "value": "{{webserver_ipv6}}", "ttl": 300},
        {"name": "www", "type": "CNAME", "value": "@", "ttl": 300},
        {"name": "mail", "type": "A", "value": "{{webserver_ip}}", "ttl": 300}
    ]'::jsonb,
    '00000000-0000-0000-0000-000000000001'
),
(
    NULL, -- Global template
    'Mail Server',
    'Mail server zone with MX, SPF, and DKIM records',
    '["domain", "mail_server", "mail_priority"]'::jsonb,
    '[
        {"name": "@", "type": "MX", "value": "{{mail_server}}", "priority": "{{mail_priority}}", "ttl": 300},
        {"name": "@", "type": "TXT", "value": "v=spf1 mx -all", "ttl": 300},
        {"name": "mail", "type": "A", "value": "{{mail_server}}", "ttl": 300}
    ]'::jsonb,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Set the templates as public
UPDATE zone_templates SET is_public = true WHERE tenant_id IS NULL;

-- Insert sample audit log entries
INSERT INTO audit_logs (tenant_id, user_id, operation, resource_type, resource_id, details, source_ip, success) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'CREATE_ZONE',
    'dns_zone',
    '00000000-0000-0000-0000-000000000001',
    '{"zone_name": "example.com", "zone_type": "master"}'::jsonb,
    '127.0.0.1',
    true
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'CREATE_RECORD',
    'dns_record',
    NULL,
    '{"zone": "example.com", "name": "www", "type": "A", "value": "192.168.1.100"}'::jsonb,
    '127.0.0.1',
    true
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'GENERATE_TSIG_KEY',
    'tsig_key',
    NULL,
    '{"key_name": "update-key", "algorithm": "hmac-sha256"}'::jsonb,
    '127.0.0.1',
    true
);

-- Insert sample DDNS update history
INSERT INTO ddns_updates (tenant_id, zone_id, record_name, record_type, old_value, new_value, ttl, source_ip, status) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'dynamic1',
    'A',
    '192.168.1.200',
    '192.168.1.201',
    300,
    '192.168.1.50',
    'success'
),
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'dynamic2',
    'A',
    NULL,
    '192.168.1.202',
    300,
    '192.168.1.51',
    'success'
);

-- Insert sample DNS query logs
INSERT INTO dns_query_logs (tenant_id, client_ip, query_name, query_type, response_code, response_time, recursive, cached) VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    '192.168.1.10',
    'www.example.com',
    'A',
    'NOERROR',
    15,
    false,
    true
),
(
    '00000000-0000-0000-0000-000000000001',
    '192.168.1.11',
    'mail.example.com',
    'A',
    'NOERROR',
    8,
    false,
    false
),
(
    '00000000-0000-0000-0000-000000000001',
    '192.168.1.12',
    'nonexistent.example.com',
    'A',
    'NXDOMAIN',
    12,
    false,
    false
);

-- Update statistics
UPDATE tenants SET
    settings = settings || jsonb_build_object('stats', jsonb_build_object('zones', 2, 'records', 15, 'last_update', NOW()::text))
WHERE id = '00000000-0000-0000-0000-000000000001';
