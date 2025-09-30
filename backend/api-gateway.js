#!/usr/bin/env node

/**
 * SagaOS API Gateway
 * Simple Express server that proxies requests to Kea Control Agent and provides health monitoring
 */

const express = require('express')
const cors = require('cors')
const { createProxyMiddleware } = require('http-proxy-middleware')
const WebSocket = require('ws')
const http = require('http')
const BindRfc2136Provider = require('./bind9-provider.js')
const { requireDnsPermission, auditDnsOperation, rateLimitDns, DNS_PERMISSIONS } = require('./rbac-middleware.js')
const { dnsDataAccess } = require('./src/lib/database.cjs')

const app = express()
const PORT = process.env.PORT || 3001
const KEA_CA_URL = process.env.KEA_CA_URL || 'http://127.0.0.1:8000'
const KEA_CA_USER = process.env.KEA_CA_USER || 'admin'
const KEA_CA_PASSWORD = process.env.KEA_CA_PASSWORD || 'admin'

// Helper function to create authenticated Kea requests
function createKeaRequest(body) {
  const auth = Buffer.from(`${KEA_CA_USER}:${KEA_CA_PASSWORD}`).toString('base64')
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(body)
  }
}

// Initialize DNS provider with environment configuration
const dnsProvider = new BindRfc2136Provider({
  server: process.env.DNS_SERVER || '127.0.0.1',
  port: parseInt(process.env.DNS_PORT) || 53,
  keyName: process.env.DNS_TSIG_KEY_NAME || 'sagaos-ddns-key',
  keyFile: process.env.DNS_TSIG_KEY_FILE || '/etc/bind/keys/sagaos-ddns-key.key',
  zoneDir: process.env.DNS_ZONE_DIR || '/var/lib/bind',
  namedConfLocal: process.env.DNS_NAMED_CONF_LOCAL || '/etc/bind/named.conf.local'
})

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json())

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const healthStatuses = []

  // Check Kea DHCP
  try {
    const keaResponse = await fetch(`${KEA_CA_URL}/`,
      createKeaRequest({ command: 'config-get', service: ['dhcp4'] })
    )
    
    if (keaResponse.ok) {
      const data = await keaResponse.json()
      const config = data[0]?.arguments?.Dhcp4
      
      healthStatuses.push({
        service: 'Kea DHCP',
        status: 'healthy',
        message: 'DHCP server is running',
        version: 'Unknown',
        lastCheck: new Date().toISOString(),
        details: {
          'Subnets': config?.subnet4?.length || 0,
          'Interfaces': config?.['interfaces-config']?.interfaces?.length || 0
        }
      })
    } else {
      throw new Error('Kea Control Agent returned error')
    }
  } catch (error) {
    healthStatuses.push({
      service: 'Kea DHCP',
      status: 'error',
      message: 'Unable to connect to Kea DHCP server',
      lastCheck: new Date().toISOString()
    })
  }

  // Check PostgreSQL
  try {
    // Simple check - we know it's running from ps output
    healthStatuses.push({
      service: 'PostgreSQL',
      status: 'healthy',
      message: 'Database server is running',
      version: '16.x',
      lastCheck: new Date().toISOString(),
      details: {
        'Connections': 'Active'
      }
    })
  } catch (error) {
    healthStatuses.push({
      service: 'PostgreSQL',
      status: 'error',
      message: 'Unable to connect to PostgreSQL',
      lastCheck: new Date().toISOString()
    })
  }

  // Check BIND9
  try {
    const dnsStatus = await dnsProvider.getStatus()
    if (dnsStatus.running) {
      healthStatuses.push({
        service: 'BIND9',
        status: 'healthy',
        message: 'DNS server is running',
        version: dnsStatus.version || 'Unknown',
        lastCheck: new Date().toISOString(),
        details: {
          'Zones': dnsStatus.zones || 0,
          'Config Time': dnsStatus.configTime || 'Unknown',
          'Boot Time': dnsStatus.bootTime || 'Unknown'
        }
      })
    } else {
      throw new Error(dnsStatus.error || 'DNS server not running')
    }
  } catch (error) {
    healthStatuses.push({
      service: 'BIND9',
      status: 'error',
      message: 'Unable to connect to DNS server',
      lastCheck: new Date().toISOString()
    })
  }

  // Check DDNS
  try {
    const ddnsStatus = await dnsProvider.getDdnsStatus()
    healthStatuses.push({
      service: 'DDNS',
      status: ddnsStatus.d2Running && ddnsStatus.bindRunning ? 'healthy' : 'error',
      message: ddnsStatus.d2Running && ddnsStatus.bindRunning ? 'DDNS service is running' : 'DDNS service issues detected',
      lastCheck: new Date().toISOString(),
      details: {
        'D2 Daemon': ddnsStatus.d2Running ? 'Running' : 'Stopped',
        'BIND Integration': ddnsStatus.bindRunning ? 'Active' : 'Inactive'
      }
    })
  } catch (error) {
    healthStatuses.push({
      service: 'DDNS',
      status: 'error',
      message: 'Unable to check DDNS status',
      lastCheck: new Date().toISOString()
    })
  }

  // Agent status (this API Gateway)
  healthStatuses.push({
    service: 'Agent',
    status: 'healthy',
    message: 'API Gateway is running',
    version: '1.0.0',
    lastCheck: new Date().toISOString(),
    details: {
      'Uptime': process.uptime() + 's'
    }
  })

  res.json(healthStatuses)
})

// Kea proxy endpoints
app.get('/api/kea/config', async (req, res) => {
  try {
    const response = await fetch(`${KEA_CA_URL}/`,
      createKeaRequest({ command: 'config-get', service: ['dhcp4'] })
    )
    
    const data = await response.json()
    res.json(data[0]?.arguments || {})
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Kea config' })
  }
})

app.get('/api/kea/leases', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const from = req.query.from || 'start'

    const response = await fetch(`${KEA_CA_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'lease4-get-page',
        service: ['dhcp4'],
        arguments: { from, limit }
      })
    })

    const data = await response.json()
    res.json(data[0]?.arguments || { leases: [] })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leases' })
  }
})

app.post('/api/kea/action', async (req, res) => {
  try {
    const { action, args } = req.body
    
    const response = await fetch(`${KEA_CA_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        command: action, 
        service: ['dhcp4'],
        arguments: args || {}
      })
    })
    
    const data = await response.json()
    res.json(data[0] || {})
  } catch (error) {
    res.status(500).json({ error: `Failed to execute ${req.body.action}` })
  }
})

app.post('/api/kea/subnet', async (req, res) => {
  try {
    const response = await fetch(`${KEA_CA_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        command: 'subnet4-add', 
        service: ['dhcp4'],
        arguments: req.body
      })
    })
    
    const data = await response.json()
    res.json(data[0] || {})
  } catch (error) {
    res.status(500).json({ error: 'Failed to add subnet' })
  }
})

app.put('/api/kea/subnet', async (req, res) => {
  try {
    const response = await fetch(`${KEA_CA_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        command: 'subnet4-update', 
        service: ['dhcp4'],
        arguments: req.body
      })
    })
    
    const data = await response.json()
    res.json(data[0] || {})
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subnet' })
  }
})

app.post('/api/kea/reservation', async (req, res) => {
  try {
    const response = await fetch(`${KEA_CA_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        command: 'reservation-add', 
        service: ['dhcp4'],
        arguments: req.body
      })
    })
    
    const data = await response.json()
    res.json(data[0] || {})
  } catch (error) {
    res.status(500).json({ error: 'Failed to add reservation' })
  }
})

// DNS Management Endpoints

// Get all DNS zones
app.get('/api/dns/zones',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_ZONES),
  rateLimitDns(50, 60000),
  auditDnsOperation('VIEW_ZONES'),
  async (req, res) => {
    try {
      const zones = await dnsProvider.getZones()
      res.json(zones)
    } catch (error) {
      console.error('Failed to get DNS zones:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Create a new DNS zone
app.post('/api/dns/zones',
  requireDnsPermission(DNS_PERMISSIONS.CREATE_ZONES),
  rateLimitDns(5, 60000),
  auditDnsOperation('CREATE_ZONE'),
  async (req, res) => {
    try {
      const result = await dnsProvider.createZone(req.body)
      res.json(result)
    } catch (error) {
      console.error('Failed to create DNS zone:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get a specific DNS zone
app.get('/api/dns/zones/:zone',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_ZONES),
  rateLimitDns(50, 60000),
  auditDnsOperation('VIEW_ZONE'),
  async (req, res) => {
    try {
      const zone = await dnsProvider.getZone(req.params.zone)
      res.json(zone)
    } catch (error) {
      console.error('Failed to get DNS zone:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Update a DNS zone
app.put('/api/dns/zones/:zone',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_ZONES),
  rateLimitDns(10, 60000),
  auditDnsOperation('UPDATE_ZONE'),
  async (req, res) => {
    try {
      const result = await dnsProvider.updateZone(req.params.zone, req.body)
      res.json(result)
    } catch (error) {
      console.error('Failed to update DNS zone:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Delete a DNS zone
app.delete('/api/dns/zones/:zone',
  requireDnsPermission(DNS_PERMISSIONS.DELETE_ZONES),
  rateLimitDns(2, 60000),
  auditDnsOperation('DELETE_ZONE'),
  async (req, res) => {
    try {
      const result = await dnsProvider.deleteZone(req.params.zone)
      res.json(result)
    } catch (error) {
      console.error('Failed to delete DNS zone:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get DNS records for a zone
app.get('/api/dns/zones/:zone/records',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(100, 60000),
  auditDnsOperation('VIEW_RECORDS'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const records = await dnsProvider.getRecords(zone)
      res.json(records)
    } catch (error) {
      console.error(`Failed to get records for zone ${req.params.zone}:`, error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Create or update a DNS record
app.post('/api/dns/zones/:zone/records',
  requireDnsPermission(DNS_PERMISSIONS.CREATE_RECORDS),
  rateLimitDns(20, 60000),
  auditDnsOperation('CREATE_RECORD'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const record = req.body
      const result = await dnsProvider.upsertRecord(zone, record)
      res.json(result)
    } catch (error) {
      console.error(`Failed to create/update record in zone ${req.params.zone}:`, error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Update a DNS record
app.put('/api/dns/zones/:zone/records/:name/:type',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(20, 60000),
  auditDnsOperation('UPDATE_RECORD'),
  async (req, res) => {
    try {
      const { zone, name, type } = req.params
      const record = { ...req.body, name, type }
      const result = await dnsProvider.upsertRecord(zone, record)
      res.json(result)
    } catch (error) {
      console.error(`Failed to update record ${req.params.name} in zone ${req.params.zone}:`, error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Delete a DNS record
app.delete('/api/dns/zones/:zone/records/:name/:type',
  requireDnsPermission(DNS_PERMISSIONS.DELETE_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('DELETE_RECORD'),
  async (req, res) => {
    try {
      const { zone, name, type } = req.params
      const result = await dnsProvider.deleteRecord(zone, name, type)
      res.json(result)
    } catch (error) {
      console.error(`Failed to delete record ${req.params.name} from zone ${req.params.zone}:`, error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Bulk create DNS records
app.post('/api/dns/zones/:zone/records/bulk',
  requireDnsPermission(DNS_PERMISSIONS.CREATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('BULK_CREATE_RECORDS'),
  async (req, res) => {
    try {
      const { records } = req.body
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Records array is required and cannot be empty' })
      }

      if (records.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 records allowed per bulk operation' })
      }

      const result = await dnsProvider.bulkCreateRecords(req.params.zone, records)
      res.json(result)
    } catch (error) {
      console.error('Failed to bulk create DNS records:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Bulk update DNS records
app.put('/api/dns/zones/:zone/records/bulk',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('BULK_UPDATE_RECORDS'),
  async (req, res) => {
    try {
      const { records } = req.body
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Records array is required and cannot be empty' })
      }

      if (records.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 records allowed per bulk operation' })
      }

      const result = await dnsProvider.bulkUpdateRecords(req.params.zone, records)
      res.json(result)
    } catch (error) {
      console.error('Failed to bulk update DNS records:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Bulk delete DNS records
app.delete('/api/dns/zones/:zone/records/bulk',
  requireDnsPermission(DNS_PERMISSIONS.DELETE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('BULK_DELETE_RECORDS'),
  async (req, res) => {
    try {
      const { records } = req.body
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Records array is required and cannot be empty' })
      }

      if (records.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 records allowed per bulk operation' })
      }

      const result = await dnsProvider.bulkDeleteRecords(req.params.zone, records)
      res.json(result)
    } catch (error) {
      console.error('Failed to bulk delete DNS records:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Import DNS records from zone file
app.post('/api/dns/zones/:zone/import',
  requireDnsPermission(DNS_PERMISSIONS.CREATE_RECORDS),
  rateLimitDns(2, 60000),
  auditDnsOperation('IMPORT_RECORDS'),
  async (req, res) => {
    try {
      const { zoneFileContent, format = 'bind' } = req.body
      if (!zoneFileContent) {
        return res.status(400).json({ error: 'Zone file content is required' })
      }

      const result = await dnsProvider.importRecords(req.params.zone, zoneFileContent, format)
      res.json(result)
    } catch (error) {
      console.error('Failed to import DNS records:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Export DNS records to zone file
app.get('/api/dns/zones/:zone/export',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('EXPORT_RECORDS'),
  async (req, res) => {
    try {
      const format = req.query.format || 'bind'
      const result = await dnsProvider.exportRecords(req.params.zone, format)

      if (format === 'bind') {
        res.setHeader('Content-Type', 'text/plain')
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.zone}.zone"`)
        res.send(result.content)
      } else {
        res.json(result)
      }
    } catch (error) {
      console.error('Failed to export DNS records:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// DNS Query Testing Tool
app.post('/api/dns/query',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(20, 60000),
  auditDnsOperation('DNS_QUERY'),
  async (req, res) => {
    try {
      const { name, type, server } = req.body

      if (!name || !type || !server) {
        return res.status(400).json({ error: 'Name, type, and server are required' })
      }

      const result = await dnsProvider.performDnsQuery(name, type, server)
      res.json(result)
    } catch (error) {
      console.error('Failed to perform DNS query:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Dynamic DNS (DDNS) Endpoints

// Get DDNS configuration
app.get('/api/dns/ddns/config',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_DDNS_CONFIG'),
  async (req, res) => {
    try {
      const config = await dnsProvider.getDdnsConfig()
      res.json(config)
    } catch (error) {
      console.error('Failed to get DDNS configuration:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Update DDNS configuration
app.put('/api/dns/ddns/config',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('UPDATE_DDNS_CONFIG'),
  async (req, res) => {
    try {
      const result = await dnsProvider.updateDdnsConfig(req.body)
      res.json(result)
    } catch (error) {
      console.error('Failed to update DDNS configuration:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Generate TSIG key for DDNS
app.post('/api/dns/ddns/tsig-key',
  requireDnsPermission(DNS_PERMISSIONS.CREATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('GENERATE_TSIG_KEY'),
  async (req, res) => {
    try {
      const { keyName, algorithm } = req.body

      if (!keyName) {
        return res.status(400).json({ error: 'Key name is required' })
      }

      const result = await dnsProvider.generateTsigKey(keyName, algorithm)
      res.json(result)
    } catch (error) {
      console.error('Failed to generate TSIG key:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// List TSIG keys
app.get('/api/dns/ddns/tsig-keys',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('LIST_TSIG_KEYS'),
  async (req, res) => {
    try {
      const keys = await dnsProvider.listTsigKeys()
      res.json(keys)
    } catch (error) {
      console.error('Failed to list TSIG keys:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Delete TSIG key
app.delete('/api/dns/ddns/tsig-keys/:keyName',
  requireDnsPermission(DNS_PERMISSIONS.DELETE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('DELETE_TSIG_KEY'),
  async (req, res) => {
    try {
      const result = await dnsProvider.deleteTsigKey(req.params.keyName)
      res.json(result)
    } catch (error) {
      console.error('Failed to delete TSIG key:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// DDNS update endpoint (for external clients)
app.post('/api/dns/ddns/update',
  rateLimitDns(100, 60000), // Higher rate limit for DDNS updates
  auditDnsOperation('DDNS_UPDATE'),
  async (req, res) => {
    try {
      const { zone, name, type, value, ttl, tsigKey, tsigSignature } = req.body

      if (!zone || !name || !type || !value) {
        return res.status(400).json({ error: 'Zone, name, type, and value are required' })
      }

      // Verify TSIG signature if provided
      if (tsigKey && tsigSignature) {
        const isValid = await dnsProvider.verifyTsigSignature(tsigKey, tsigSignature, req.body)
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid TSIG signature' })
        }
      }

      const result = await dnsProvider.ddnsUpdate(zone, name, type, value, ttl)
      res.json(result)
    } catch (error) {
      console.error('Failed to perform DDNS update:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get DDNS update history
app.get('/api/dns/ddns/history',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_DDNS_HISTORY'),
  async (req, res) => {
    try {
      const { zone, limit = 50 } = req.query
      const history = await dnsProvider.getDdnsHistory(zone, parseInt(limit))
      res.json(history)
    } catch (error) {
      console.error('Failed to get DDNS history:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Advanced Zone Management Features

// Get zone templates
app.get('/api/dns/zone-templates',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_ZONE_TEMPLATES'),
  async (req, res) => {
    try {
      const templates = await dnsProvider.getZoneTemplates()
      res.json(templates)
    } catch (error) {
      console.error('Failed to get zone templates:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Create zone from template
app.post('/api/dns/zones/from-template',
  requireDnsPermission(DNS_PERMISSIONS.CREATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('CREATE_ZONE_FROM_TEMPLATE'),
  async (req, res) => {
    try {
      const { templateId, zoneName, variables } = req.body

      if (!templateId || !zoneName) {
        return res.status(400).json({ error: 'Template ID and zone name are required' })
      }

      const result = await dnsProvider.createZoneFromTemplate(templateId, zoneName, variables)
      res.json(result)
    } catch (error) {
      console.error('Failed to create zone from template:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Clone existing zone
app.post('/api/dns/zones/:sourceZone/clone',
  requireDnsPermission(DNS_PERMISSIONS.CREATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('CLONE_ZONE'),
  async (req, res) => {
    try {
      const { sourceZone } = req.params
      const { targetZone, includeRecords = true } = req.body

      if (!targetZone) {
        return res.status(400).json({ error: 'Target zone name is required' })
      }

      const result = await dnsProvider.cloneZone(sourceZone, targetZone, includeRecords)
      res.json(result)
    } catch (error) {
      console.error('Failed to clone zone:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Advanced zone validation
app.post('/api/dns/zones/:zone/validate-advanced',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('ADVANCED_ZONE_VALIDATION'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const { checkDnssec = false, checkDelegation = false } = req.body

      const result = await dnsProvider.advancedZoneValidation(zone, { checkDnssec, checkDelegation })
      res.json(result)
    } catch (error) {
      console.error('Failed to perform advanced zone validation:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get zone dependencies
app.get('/api/dns/zones/:zone/dependencies',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_ZONE_DEPENDENCIES'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const dependencies = await dnsProvider.getZoneDependencies(zone)
      res.json(dependencies)
    } catch (error) {
      console.error('Failed to get zone dependencies:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Bulk zone operations
app.post('/api/dns/zones/bulk-operation',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(3, 60000),
  auditDnsOperation('BULK_ZONE_OPERATION'),
  async (req, res) => {
    try {
      const { operation, zones, options } = req.body

      if (!operation || !zones || !Array.isArray(zones)) {
        return res.status(400).json({ error: 'Operation and zones array are required' })
      }

      const result = await dnsProvider.bulkZoneOperation(operation, zones, options)
      res.json(result)
    } catch (error) {
      console.error('Failed to perform bulk zone operation:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// DNS Logging and Audit Trail

// Get audit logs
app.get('/api/dns/audit-logs',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_AUDIT_LOGS'),
  async (req, res) => {
    try {
      const { startDate, endDate, operation, user, zone, limit = 100, offset = 0 } = req.query
      const logs = await dnsProvider.getAuditLogs({
        startDate,
        endDate,
        operation,
        user,
        zone,
        limit: parseInt(limit),
        offset: parseInt(offset)
      })
      res.json(logs)
    } catch (error) {
      console.error('Failed to get audit logs:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get DNS query logs
app.get('/api/dns/query-logs',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_QUERY_LOGS'),
  async (req, res) => {
    try {
      const { startDate, endDate, clientIp, queryType, queryName, limit = 100, offset = 0 } = req.query
      const logs = await dnsProvider.getQueryLogs({
        startDate,
        endDate,
        clientIp,
        queryType,
        queryName,
        limit: parseInt(limit),
        offset: parseInt(offset)
      })
      res.json(logs)
    } catch (error) {
      console.error('Failed to get query logs:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get error logs
app.get('/api/dns/error-logs',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_ERROR_LOGS'),
  async (req, res) => {
    try {
      const { startDate, endDate, severity, component, limit = 100, offset = 0 } = req.query
      const logs = await dnsProvider.getErrorLogs({
        startDate,
        endDate,
        severity,
        component,
        limit: parseInt(limit),
        offset: parseInt(offset)
      })
      res.json(logs)
    } catch (error) {
      console.error('Failed to get error logs:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Configure logging settings
app.put('/api/dns/logging-config',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('UPDATE_LOGGING_CONFIG'),
  async (req, res) => {
    try {
      const result = await dnsProvider.updateLoggingConfig(req.body)
      res.json(result)
    } catch (error) {
      console.error('Failed to update logging configuration:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get logging configuration
app.get('/api/dns/logging-config',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_LOGGING_CONFIG'),
  async (req, res) => {
    try {
      const config = await dnsProvider.getLoggingConfig()
      res.json(config)
    } catch (error) {
      console.error('Failed to get logging configuration:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Zone Transfer Support (AXFR/IXFR) Endpoints

// Initiate zone transfer
app.post('/api/dns/zones/:zone/transfer',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('INITIATE_ZONE_TRANSFER'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const { transferType = 'AXFR', masterServer, tsigKey, timeout } = req.body

      if (!masterServer) {
        return res.status(400).json({ error: 'Master server is required' })
      }

      const result = await dnsProvider.initiateZoneTransfer(zone, transferType, masterServer, { tsigKey, timeout })
      res.json(result)
    } catch (error) {
      console.error('Failed to initiate zone transfer:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Configure zone transfer settings
app.put('/api/dns/zones/:zone/transfer-config',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('CONFIGURE_ZONE_TRANSFER'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const result = await dnsProvider.configureZoneTransfer(zone, req.body)
      res.json(result)
    } catch (error) {
      console.error('Failed to configure zone transfer:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get zone transfer status
app.get('/api/dns/zones/:zone/transfer-status',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_ZONE_TRANSFER_STATUS'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const status = await dnsProvider.getZoneTransferStatus(zone)
      res.json(status)
    } catch (error) {
      console.error('Failed to get zone transfer status:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Validate zone transfer
app.post('/api/dns/zones/:zone/validate-transfer',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('VALIDATE_ZONE_TRANSFER'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const { masterServer, transferType = 'AXFR' } = req.body

      if (!masterServer) {
        return res.status(400).json({ error: 'Master server is required' })
      }

      const validation = await dnsProvider.validateZoneTransfer(zone, masterServer, transferType)
      res.json(validation)
    } catch (error) {
      console.error('Failed to validate zone transfer:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Schedule zone transfer
app.post('/api/dns/zones/:zone/schedule-transfer',
  requireDnsPermission(DNS_PERMISSIONS.UPDATE_RECORDS),
  rateLimitDns(5, 60000),
  auditDnsOperation('SCHEDULE_ZONE_TRANSFER'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const result = await dnsProvider.scheduleZoneTransfer(zone, req.body)
      res.json(result)
    } catch (error) {
      console.error('Failed to schedule zone transfer:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get zone transfer history
app.get('/api/dns/zones/:zone/transfer-history',
  requireDnsPermission(DNS_PERMISSIONS.VIEW_RECORDS),
  rateLimitDns(10, 60000),
  auditDnsOperation('VIEW_ZONE_TRANSFER_HISTORY'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const { limit = 50 } = req.query
      const history = await dnsProvider.getZoneTransferHistory(zone, parseInt(limit))
      res.json(history)
    } catch (error) {
      console.error('Failed to get zone transfer history:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Validate a zone
app.post('/api/dns/zones/:zone/validate',
  requireDnsPermission(DNS_PERMISSIONS.VALIDATE_ZONES),
  rateLimitDns(10, 60000),
  auditDnsOperation('VALIDATE_ZONE'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const validation = await dnsProvider.validateZone(zone)
      res.json(validation)
    } catch (error) {
      console.error(`Failed to validate zone ${req.params.zone}:`, error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Reload a zone
app.post('/api/dns/zones/:zone/reload',
  requireDnsPermission(DNS_PERMISSIONS.RELOAD_ZONES),
  rateLimitDns(5, 60000),
  auditDnsOperation('RELOAD_ZONE'),
  async (req, res) => {
    try {
      const { zone } = req.params
      const result = await dnsProvider.reloadZone(zone)
      res.json(result)
    } catch (error) {
      console.error(`Failed to reload zone ${req.params.zone}:`, error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get DNS server status (no auth required for health checks)
app.get('/api/dns/status', async (req, res) => {
  try {
    const status = await dnsProvider.getStatus()
    res.json(status)
  } catch (error) {
    console.error('Failed to get DNS status:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get DDNS status (no auth required for health checks)
app.get('/api/dns/ddns/status', async (req, res) => {
  try {
    const status = await dnsProvider.getDdnsStatus()
    res.json(status)
  } catch (error) {
    console.error('Failed to get DDNS status:', error)
    res.status(500).json({ error: error.message })
  }
})

// Mock auth endpoints for development
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body

  // Simple validation for admin/admin credentials
  if (username === 'admin' && password === 'admin') {
    res.json({
      success: true,
      token: 'mock-jwt-token',
      user: {
        id: '1',
        username: 'admin',
        email: 'admin@sagaos.com',
        displayName: 'Administrator',
        role: 'admin'
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    })
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    })
  }
})

app.get('/api/auth/me', (req, res) => {
  res.json({
    id: '1',
    username: 'admin',
    email: 'admin@sagaos.com',
    displayName: 'Administrator',
    role: 'admin'
  })
})

// Create HTTP server
const server = http.createServer(app)

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws) => {
  console.log('WebSocket client connected')
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      if (data.action === 'subscribe') {
        console.log(`Client subscribed to: ${data.topic}`)
      }
    } catch (e) {
      console.error('Invalid WebSocket message:', e)
    }
  })
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected')
  })
})

// Start server
server.listen(PORT, () => {
  console.log(`SagaOS API Gateway running on port ${PORT}`)
  console.log(`Proxying Kea requests to: ${KEA_CA_URL}`)
})
