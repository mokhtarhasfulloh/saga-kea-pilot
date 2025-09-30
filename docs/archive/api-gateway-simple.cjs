const express = require('express')
const cors = require('cors')
const axios = require('axios')
const { Pool } = require('pg')
const fs = require('fs').promises
const crypto = require('crypto')
const WebSocket = require('ws')
const http = require('http')

// Import DNS provider
let BindRfc2136Provider
try {
  BindRfc2136Provider = require('./bind9-provider.cjs')
} catch (error) {
  console.warn('BIND9 provider not available:', error.message)
  BindRfc2136Provider = null
}

const app = express()
const PORT = process.env.PORT || 3001
const KEA_CA_URL = process.env.KEA_CA_URL || 'http://127.0.0.1:8000'

// PostgreSQL connection pool
const pgPool = new Pool({
  user: process.env.DB_USER || 'kea',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'kea',
  password: process.env.DB_PASSWORD || 'kea123',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Initialize DNS provider if available
let dnsProvider = null
if (BindRfc2136Provider) {
  dnsProvider = new BindRfc2136Provider({
    server: process.env.DNS_SERVER || '127.0.0.1',
    port: parseInt(process.env.DNS_PORT) || 53,
    keyName: process.env.DNS_TSIG_KEY_NAME || 'sagaos-ddns-key',
    keyFile: process.env.DNS_TSIG_KEY_FILE || '/etc/bind/keys/sagaos-ddns-key.key'
  })
}

// Database initialization
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...')

    // Test connection
    const client = await pgPool.connect()
    await client.query('SELECT NOW()')
    client.release()

    // Check if schemas exist, if not apply them
    const dnsSchemaCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'dns_audit_log'
      );
    `)

    const usersSchemaCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `)

    if (!usersSchemaCheck.rows[0].exists) {
      console.log('📋 Applying users schema...')
      const usersSchema = await fs.readFile('./users-schema.sql', 'utf8')
      await pgPool.query(usersSchema)
      console.log('✅ Users schema applied successfully')
    }

    if (!dnsSchemaCheck.rows[0].exists) {
      console.log('📋 Applying DNS schema...')
      const dnsSchema = await fs.readFile('./dns-schema.sql', 'utf8')
      await pgPool.query(dnsSchema)
      console.log('✅ DNS schema applied successfully')
    }

    if (dnsSchemaCheck.rows[0].exists && usersSchemaCheck.rows[0].exists) {
      console.log('✅ Database schemas already exist')
    }

    console.log('✅ Database initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message)
    throw error
  }
}

// Session storage in database
const sessions = new Map() // Temporary fallback, will move to DB

// User management functions
async function getUserByUsername(username) {
  try {
    const result = await pgPool.query(
      'SELECT id, username, password_hash, email, display_name, role, created_at FROM users WHERE username = $1 AND active = true',
      [username]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

async function createDefaultAdmin() {
  try {
    // Check if admin user exists
    const existingAdmin = await getUserByUsername('admin')
    if (existingAdmin) {
      return existingAdmin
    }

    // Create admin user if not exists
    const passwordHash = crypto.createHash('sha256').update('admin').digest('hex')
    const result = await pgPool.query(`
      INSERT INTO users (username, password_hash, email, display_name, role, active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username, email, display_name, role
    `, ['admin', passwordHash, 'admin@sagaos.com', 'Administrator', 'admin'])

    return result.rows[0]
  } catch (error) {
    console.error('Error creating default admin:', error)
    // Fallback to in-memory user for development
    return {
      id: '1',
      username: 'admin',
      email: 'admin@sagaos.com',
      display_name: 'Administrator',
      role: 'admin'
    }
  }
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}))
app.use(express.json())

// Authentication middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = authHeader.substring(7)
  const session = sessions.get(token)

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = session.user
  next()
}

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      })
    }

    // Get user from database
    const user = await getUserByUsername(username)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      })
    }

    // Verify password (simple hash for now, use bcrypt in production)
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      })
    }

    // Generate token
    const token = 'token_' + crypto.randomBytes(16).toString('hex') + '_' + Date.now()
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

    // Store session
    sessions.set(token, {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      expiresAt
    })

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      expiresAt: new Date(expiresAt).toISOString()
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    sessions.delete(token)
  }
  res.json({ success: true })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user)
})

// Health check endpoint - returns array format expected by frontend
app.get('/api/health', async (req, res) => {
  console.log('🔍 Health check requested from:', req.headers.origin || 'unknown')
  const healthStatuses = []

  // Check Kea DHCP
  try {
    const result = await keaCommand('config-get')
    const config = result[0]?.arguments?.Dhcp4
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
  } catch (error) {
    healthStatuses.push({
      service: 'Kea DHCP',
      status: 'error',
      message: 'Unable to connect to Kea DHCP server',
      lastCheck: new Date().toISOString()
    })
  }

  // Check BIND DNS
  try {
    if (dnsProvider) {
      const status = await dnsProvider.getStatus()
      healthStatuses.push({
        service: 'BIND DNS',
        status: status.running ? 'healthy' : 'error',
        message: status.running ? 'DNS server is running' : 'DNS server not running',
        version: status.version || 'Unknown',
        lastCheck: new Date().toISOString(),
        details: {
          'Zones': status.zones || 0,
          'Config Time': status.configTime || 'Unknown',
          'Boot Time': status.bootTime || 'Unknown',
          'Queries': 0
        }
      })
    } else {
      throw new Error('DNS provider not available')
    }
  } catch (error) {
    healthStatuses.push({
      service: 'BIND DNS',
      status: 'error',
      message: 'Unable to connect to DNS server',
      lastCheck: new Date().toISOString()
    })
  }

  // Check DDNS
  try {
    if (dnsProvider) {
      const ddnsStatus = await dnsProvider.getDdnsStatus()
      healthStatuses.push({
        service: 'DDNS',
        status: ddnsStatus.d2Running && ddnsStatus.bindRunning ? 'healthy' : 'error',
        message: ddnsStatus.d2Running && ddnsStatus.bindRunning ? 'DDNS service is running' : 'DDNS service issues detected',
        lastCheck: new Date().toISOString(),
        details: {
          'D2 Daemon': ddnsStatus.d2Running ? 'Running' : 'Stopped',
          'BIND Integration': ddnsStatus.bindRunning ? 'Active' : 'Inactive',
          'Last Update': new Date().toISOString()
        }
      })
    } else {
      throw new Error('DNS provider not available')
    }
  } catch (error) {
    healthStatuses.push({
      service: 'DDNS',
      status: 'error',
      message: 'Unable to check DDNS status',
      lastCheck: new Date().toISOString()
    })
  }

  // Check PostgreSQL
  try {
    const client = await pgPool.connect()
    const result = await client.query('SELECT NOW() as current_time, version() as version')
    client.release()
    const version = result.rows[0].version.split(' ')[1] // Extract version number
    healthStatuses.push({
      service: 'PostgreSQL',
      status: 'healthy',
      message: 'Database is connected',
      version: version || 'Unknown',
      lastCheck: new Date().toISOString(),
      details: {
        'Connections': 'Active',
        'Database': 'kea'
      }
    })
  } catch (error) {
    healthStatuses.push({
      service: 'PostgreSQL',
      status: 'error',
      message: 'Unable to connect to PostgreSQL database',
      lastCheck: new Date().toISOString()
    })
  }

  // Check Kea Pilot Agent (this API Gateway)
  healthStatuses.push({
    service: 'Kea Pilot Agent',
    status: 'healthy',
    message: 'Agent is running',
    version: '1.0.0',
    lastCheck: new Date().toISOString(),
    details: {
      'CPU': 'Unknown',
      'Memory': 'Unknown'
    }
  })

  res.json(healthStatuses)
})

// Individual health check endpoints for frontend fallback
app.get('/api/health/postgres', async (req, res) => {
  console.log('🔍 PostgreSQL health check requested from:', req.headers.origin || 'unknown')
  try {
    const client = await pgPool.connect()
    const result = await client.query('SELECT NOW() as current_time, version() as version, current_database() as database')
    client.release()
    const version = result.rows[0].version.split(' ')[1]
    res.json({
      connected: true,
      version: version,
      database: result.rows[0].database,
      connections: 'Active'
    })
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    })
  }
})

app.get('/api/health/agent', async (req, res) => {
  console.log('🔍 Agent health check requested from:', req.headers.origin || 'unknown')
  res.json({
    status: 'running',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    cpu: 'Unknown',
    memory: 'Unknown'
  })
})

// Kea DHCP integration functions
async function keaCommand(command, service = 'dhcp4', arguments_obj = {}) {
  try {
    const payload = {
      command,
      service: [service],
      arguments: arguments_obj
    }

    const response = await axios.post(`${KEA_CA_URL}/`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    })

    return response.data
  } catch (error) {
    console.error(`Kea command ${command} failed:`, error.message)
    throw new Error(`Failed to execute Kea command: ${error.message}`)
  }
}

// Kea DHCP proxy endpoints
app.post('/api/kea', async (req, res) => {
  try {
    const response = await axios.post(`${KEA_CA_URL}/`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    })
    res.json(response.data)
  } catch (error) {
    console.error('Kea proxy error:', error.message)
    res.status(500).json({ error: 'Failed to communicate with Kea Control Agent' })
  }
})

// Get Kea configuration
app.get('/api/kea/config', async (req, res) => {
  try {
    const result = await keaCommand('config-get')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get Kea statistics
app.get('/api/kea/statistics', async (req, res) => {
  try {
    const result = await keaCommand('statistic-get-all')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get DHCP leases
app.get('/api/kea/leases', async (req, res) => {
  try {
    const result = await keaCommand('lease4-get-all')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get specific lease by IP
app.get('/api/kea/leases/:ip', async (req, res) => {
  try {
    const result = await keaCommand('lease4-get', 'dhcp4', { 'ip-address': req.params.ip })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get subnets
app.get('/api/kea/subnets', async (req, res) => {
  try {
    const configResult = await keaCommand('config-get')
    const subnets = configResult[0]?.arguments?.Dhcp4?.subnet4 || []
    res.json({ subnets })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DNS endpoints with real provider
app.get('/api/dns/zones', async (req, res) => {
  try {
    if (dnsProvider) {
      const zones = await dnsProvider.getZones()
      res.json(zones)
    } else {
      res.json({
        zones: [
          {
            name: 'lan.sagaos.local',
            type: 'master',
            status: 'active',
            records: 5
          },
          {
            name: '0.10.in-addr.arpa',
            type: 'master',
            status: 'active',
            records: 3
          }
        ]
      })
    }
  } catch (error) {
    console.error('Failed to get DNS zones:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/dns/zones/:zone/records', async (req, res) => {
  try {
    const { zone } = req.params
    if (dnsProvider) {
      const records = await dnsProvider.getRecords(zone)
      res.json(records)
    } else {
      res.json({
        zone,
        records: [
          {
            name: 'ns1',
            type: 'A',
            value: '10.0.0.1',
            ttl: 3600
          },
          {
            name: 'gateway',
            type: 'A',
            value: '10.0.0.1',
            ttl: 300
          },
          {
            name: 'test-host',
            type: 'A',
            value: '10.0.0.100',
            ttl: 300
          }
        ]
      })
    }
  } catch (error) {
    console.error(`Failed to get records for zone ${req.params.zone}:`, error)
    res.status(500).json({ error: error.message })
  }
})

// Create or update a DNS record
app.post('/api/dns/zones/:zone/records', async (req, res) => {
  try {
    const { zone } = req.params
    const record = req.body
    if (dnsProvider) {
      const result = await dnsProvider.upsertRecord(zone, record)
      res.json(result)
    } else {
      res.json({ success: true, message: `Record ${record.name} ${record.type} would be created (BIND9 setup required)` })
    }
  } catch (error) {
    console.error(`Failed to create/update record in zone ${req.params.zone}:`, error)
    res.status(500).json({ error: error.message })
  }
})

// Update a DNS record
app.put('/api/dns/zones/:zone/records/:name/:type', async (req, res) => {
  try {
    const { zone, name, type } = req.params
    const record = { ...req.body, name, type }
    if (dnsProvider) {
      const result = await dnsProvider.upsertRecord(zone, record)
      res.json(result)
    } else {
      res.json({ success: true, message: `Record ${name} ${type} would be updated (BIND9 setup required)` })
    }
  } catch (error) {
    console.error(`Failed to update record ${req.params.name} in zone ${req.params.zone}:`, error)
    res.status(500).json({ error: error.message })
  }
})

// Delete a DNS record
app.delete('/api/dns/zones/:zone/records/:name/:type', async (req, res) => {
  try {
    const { zone, name, type } = req.params
    if (dnsProvider) {
      const result = await dnsProvider.deleteRecord(zone, name, type)
      res.json(result)
    } else {
      res.json({ success: true, message: `Record ${name} ${type} would be deleted (BIND9 setup required)` })
    }
  } catch (error) {
    console.error(`Failed to delete record ${req.params.name} from zone ${req.params.zone}:`, error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/dns/status', async (req, res) => {
  try {
    if (dnsProvider) {
      const status = await dnsProvider.getStatus()
      res.json(status)
    } else {
      res.json({
        running: false,
        version: 'BIND9 not configured',
        zones: 0,
        configTime: null,
        bootTime: null,
        message: 'BIND9 setup required - please run setup script'
      })
    }
  } catch (error) {
    console.error('Failed to get DNS status:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/dns/ddns/status', async (req, res) => {
  try {
    if (dnsProvider) {
      const status = await dnsProvider.getDdnsStatus()
      res.json(status)
    } else {
      res.json({
        d2Running: false,
        bindRunning: false,
        lastUpdate: null,
        message: 'BIND9 and DDNS setup required - please run setup script',
        stats: null
      })
    }
  } catch (error) {
    console.error('Failed to get DDNS status:', error)
    res.status(500).json({ error: error.message })
  }
})

// Start server with initialization
async function startServer() {
  try {
    // Initialize database and create default admin
    await initializeDatabase()
    await createDefaultAdmin()

    // Create HTTP server
    const server = http.createServer(app)

    // WebSocket server for real-time updates
    const wss = new WebSocket.Server({ server })

    // Store connected clients
    const clients = new Set()

    wss.on('connection', (ws, req) => {
      console.log('🔌 WebSocket client connected from:', req.headers.origin || 'unknown')
      clients.add(ws)

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message)
          if (data.type === 'auth') {
            console.log('🔐 WebSocket client authenticated')
          } else if (data.action === 'subscribe') {
            console.log(`📡 Client subscribed to: ${data.topic}`)
          }
        } catch (e) {
          console.error('❌ Invalid WebSocket message:', e)
        }
      })

      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected')
        clients.delete(ws)
      })

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        clients.delete(ws)
      })
    })

    // Function to broadcast health updates to all connected clients
    global.broadcastHealthUpdate = (service, status, data) => {
      const message = {
        type: 'health-update',
        data: {
          service,
          status,
          timestamp: new Date().toISOString(),
          ...data
        }
      }

      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(message))
          } catch (error) {
            console.error('❌ Failed to send WebSocket message:', error)
            clients.delete(client)
          }
        }
      })
    }

    // Periodic health check broadcasting
    async function broadcastHealthStatus() {
      try {
        // Get health status (reuse the same logic from the health endpoint)
        const healthStatuses = []

        // Check Kea DHCP
        try {
          const result = await keaCommand('config-get')
          const config = result[0]?.arguments?.Dhcp4
          const status = {
            service: 'Kea DHCP',
            status: 'healthy',
            message: 'DHCP server is running',
            version: 'Unknown',
            lastCheck: new Date().toISOString(),
            details: {
              'Subnets': config?.subnet4?.length || 0,
              'Interfaces': config?.['interfaces-config']?.interfaces?.length || 0
            }
          }
          healthStatuses.push(status)
          global.broadcastHealthUpdate('Kea DHCP', 'healthy', status)
        } catch (error) {
          const status = {
            service: 'Kea DHCP',
            status: 'error',
            message: 'Unable to connect to Kea DHCP server',
            lastCheck: new Date().toISOString()
          }
          healthStatuses.push(status)
          global.broadcastHealthUpdate('Kea DHCP', 'error', status)
        }

        // Check PostgreSQL
        try {
          const client = await pgPool.connect()
          const result = await client.query('SELECT NOW() as current_time, version() as version')
          client.release()
          const version = result.rows[0].version.split(' ')[1]
          const status = {
            service: 'PostgreSQL',
            status: 'healthy',
            message: 'Database is connected',
            version: version || 'Unknown',
            lastCheck: new Date().toISOString(),
            details: {
              'Connections': 'Active',
              'Database': 'kea'
            }
          }
          healthStatuses.push(status)
          global.broadcastHealthUpdate('PostgreSQL', 'healthy', status)
        } catch (error) {
          const status = {
            service: 'PostgreSQL',
            status: 'error',
            message: 'Unable to connect to PostgreSQL database',
            lastCheck: new Date().toISOString()
          }
          healthStatuses.push(status)
          global.broadcastHealthUpdate('PostgreSQL', 'error', status)
        }

        // Check Kea Pilot Agent
        const agentStatus = {
          service: 'Kea Pilot Agent',
          status: 'healthy',
          message: 'Agent is running',
          version: '1.0.0',
          lastCheck: new Date().toISOString(),
          details: {
            'CPU': 'Unknown',
            'Memory': 'Unknown'
          }
        }
        healthStatuses.push(agentStatus)
        global.broadcastHealthUpdate('Kea Pilot Agent', 'healthy', agentStatus)

      } catch (error) {
        console.error('❌ Health broadcast error:', error)
      }
    }

    server.listen(PORT, () => {
      console.log(`🚀 SagaOS API Gateway running on port ${PORT}`)
      console.log(`📡 Kea Control Agent: ${KEA_CA_URL}`)
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`)
      console.log(`🔧 DNS API: http://localhost:${PORT}/api/dns/`)
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`)
      console.log(`💾 Database: Connected to PostgreSQL`)
      console.log(`🔐 Default admin user: admin/admin`)

      // Start periodic health broadcasting every 30 seconds
      setInterval(broadcastHealthStatus, 30000)

      // Send initial health status after 5 seconds
      setTimeout(broadcastHealthStatus, 5000)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
