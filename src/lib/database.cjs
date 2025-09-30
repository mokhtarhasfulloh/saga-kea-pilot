const { Pool } = require('pg')

/**
 * PostgreSQL Database Connection and Query Interface
 * Provides connection pooling, transaction support, and tenant isolation
 */
class Database {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'sagaos_dns',
      user: process.env.DB_USER || 'sagaos',
      password: process.env.DB_PASSWORD || 'sagaos',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
      process.exit(-1)
    })
  }

  /**
   * Execute a query with optional tenant isolation
   */
  async query(text, params = [], tenantId = null) {
    const client = await this.pool.connect()
    
    try {
      // Set tenant context for RLS if provided
      if (tenantId) {
        await client.query('SET app.current_tenant_id = $1', [tenantId])
      }
      
      const result = await client.query(text, params)
      return result
    } finally {
      // Reset tenant context
      if (tenantId) {
        await client.query('RESET app.current_tenant_id')
      }
      client.release()
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries, tenantId = null) {
    const client = await this.pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Set tenant context for RLS if provided
      if (tenantId) {
        await client.query('SET app.current_tenant_id = $1', [tenantId])
      }
      
      const results = []
      for (const { text, params } of queries) {
        const result = await client.query(text, params)
        results.push(result)
      }
      
      await client.query('COMMIT')
      return results
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      // Reset tenant context
      if (tenantId) {
        await client.query('RESET app.current_tenant_id')
      }
      client.release()
    }
  }

  /**
   * Close all connections
   */
  async close() {
    await this.pool.end()
  }
}

/**
 * DNS Data Access Layer
 * Provides high-level methods for DNS data operations
 */
class DnsDataAccess {
  constructor(database) {
    this.db = database
  }

  // Zone Management
  async getZones(tenantId, filters = {}) {
    const { type, status, limit = 50, offset = 0 } = filters
    
    let query = 'SELECT * FROM dns_zones WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (type) {
      query += ` AND type = $${paramIndex++}`
      params.push(type)
    }
    
    if (status) {
      query += ` AND status = $${paramIndex++}`
      params.push(status)
    }

    query += ` ORDER BY name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await this.db.query(query, params, tenantId)
    return result.rows
  }

  async getZone(tenantId, zoneName) {
    const result = await this.db.query(
      'SELECT * FROM dns_zones WHERE name = $1',
      [zoneName],
      tenantId
    )
    return result.rows[0]
  }

  async createZone(tenantId, zoneData, userId) {
    const {
      name,
      type = 'master',
      primary_ns,
      admin_email,
      refresh_interval = 3600,
      retry_interval = 1800,
      expire_interval = 604800,
      minimum_ttl = 300
    } = zoneData

    const result = await this.db.query(
      `INSERT INTO dns_zones (
        tenant_id, name, type, primary_ns, admin_email,
        refresh_interval, retry_interval, expire_interval, minimum_ttl,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        tenantId, name, type, primary_ns, admin_email,
        refresh_interval, retry_interval, expire_interval, minimum_ttl,
        userId
      ],
      tenantId
    )
    return result.rows[0]
  }

  async updateZone(tenantId, zoneName, updates) {
    const setClause = []
    const params = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClause.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (setClause.length === 0) {
      throw new Error('No updates provided')
    }

    params.push(zoneName)
    const result = await this.db.query(
      `UPDATE dns_zones SET ${setClause.join(', ')}, updated_at = NOW()
       WHERE name = $${paramIndex} RETURNING *`,
      params,
      tenantId
    )
    return result.rows[0]
  }

  async deleteZone(tenantId, zoneName) {
    const result = await this.db.query(
      'DELETE FROM dns_zones WHERE name = $1 RETURNING *',
      [zoneName],
      tenantId
    )
    return result.rows[0]
  }

  // Record Management
  async getRecords(tenantId, zoneName, filters = {}) {
    const { type, name, limit = 50, offset = 0 } = filters
    
    let query = `
      SELECT r.* FROM dns_records r
      JOIN dns_zones z ON r.zone_id = z.id
      WHERE z.name = $1 AND r.status = 'active'
    `
    const params = [zoneName]
    let paramIndex = 2

    if (type) {
      query += ` AND r.type = $${paramIndex++}`
      params.push(type)
    }
    
    if (name) {
      query += ` AND r.name = $${paramIndex++}`
      params.push(name)
    }

    query += ` ORDER BY r.name, r.type LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await this.db.query(query, params, tenantId)
    return result.rows
  }

  async createRecord(tenantId, zoneName, recordData, userId) {
    // First get the zone ID
    const zone = await this.getZone(tenantId, zoneName)
    if (!zone) {
      throw new Error(`Zone '${zoneName}' not found`)
    }

    const {
      name,
      type,
      value,
      ttl = 300,
      priority,
      weight,
      port
    } = recordData

    const result = await this.db.query(
      `INSERT INTO dns_records (
        tenant_id, zone_id, name, type, value, ttl, priority, weight, port, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [tenantId, zone.id, name, type, value, ttl, priority, weight, port, userId],
      tenantId
    )
    return result.rows[0]
  }

  async updateRecord(tenantId, zoneName, recordName, recordType, updates) {
    const setClause = []
    const params = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClause.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (setClause.length === 0) {
      throw new Error('No updates provided')
    }

    params.push(zoneName, recordName, recordType)
    const result = await this.db.query(
      `UPDATE dns_records SET ${setClause.join(', ')}, updated_at = NOW()
       FROM dns_zones z
       WHERE dns_records.zone_id = z.id 
       AND z.name = $${paramIndex++}
       AND dns_records.name = $${paramIndex++}
       AND dns_records.type = $${paramIndex++}
       RETURNING dns_records.*`,
      params,
      tenantId
    )
    return result.rows[0]
  }

  async deleteRecord(tenantId, zoneName, recordName, recordType) {
    const result = await this.db.query(
      `DELETE FROM dns_records
       USING dns_zones z
       WHERE dns_records.zone_id = z.id 
       AND z.name = $1
       AND dns_records.name = $2
       AND dns_records.type = $3
       RETURNING dns_records.*`,
      [zoneName, recordName, recordType],
      tenantId
    )
    return result.rows[0]
  }

  // TSIG Key Management
  async getTsigKeys(tenantId) {
    const result = await this.db.query(
      'SELECT id, name, algorithm, created_at, last_used, usage_count FROM tsig_keys ORDER BY name',
      [],
      tenantId
    )
    return result.rows
  }

  async createTsigKey(tenantId, keyData, userId) {
    const { name, algorithm, secret } = keyData
    
    const result = await this.db.query(
      `INSERT INTO tsig_keys (tenant_id, name, algorithm, secret, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, algorithm, created_at`,
      [tenantId, name, algorithm, secret, userId],
      tenantId
    )
    return result.rows[0]
  }

  async deleteTsigKey(tenantId, keyName) {
    const result = await this.db.query(
      'DELETE FROM tsig_keys WHERE name = $1 RETURNING id, name',
      [keyName],
      tenantId
    )
    return result.rows[0]
  }

  // Audit Logging
  async createAuditLog(tenantId, logData) {
    const {
      user_id,
      operation,
      resource_type,
      resource_id,
      details = {},
      source_ip,
      user_agent,
      success = true,
      error_message
    } = logData

    await this.db.query(
      `INSERT INTO audit_logs (
        tenant_id, user_id, operation, resource_type, resource_id,
        details, source_ip, user_agent, success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tenantId, user_id, operation, resource_type, resource_id,
        JSON.stringify(details), source_ip, user_agent, success, error_message
      ],
      tenantId
    )
  }

  async getAuditLogs(tenantId, filters = {}) {
    const { startDate, endDate, operation, user_id, limit = 100, offset = 0 } = filters
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (startDate) {
      query += ` AND created_at >= $${paramIndex++}`
      params.push(startDate)
    }
    
    if (endDate) {
      query += ` AND created_at <= $${paramIndex++}`
      params.push(endDate)
    }
    
    if (operation) {
      query += ` AND operation = $${paramIndex++}`
      params.push(operation)
    }
    
    if (user_id) {
      query += ` AND user_id = $${paramIndex++}`
      params.push(user_id)
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await this.db.query(query, params, tenantId)
    return result.rows
  }
}

// Create singleton instances
const database = new Database()
const dnsDataAccess = new DnsDataAccess(database)

module.exports = {
  Database,
  DnsDataAccess,
  database,
  dnsDataAccess
}
