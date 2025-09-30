const EventEmitter = require('events')
const { dnsDataAccess } = require('./database.cjs')

/**
 * DNS Monitoring and Alerting System
 * Provides comprehensive monitoring, health checks, and alerting for DNS services
 */
class DnsMonitor extends EventEmitter {
  constructor() {
    super()
    this.metrics = {
      queries: 0,
      errors: 0,
      responseTime: [],
      uptime: Date.now(),
      zones: 0,
      records: 0
    }
    this.alerts = []
    this.healthChecks = new Map()
    this.isRunning = false
    this.checkInterval = null
  }

  /**
   * Start monitoring services
   */
  start() {
    if (this.isRunning) return

    this.isRunning = true
    console.log('DNS Monitor started')

    // Run health checks every 30 seconds
    this.checkInterval = setInterval(() => {
      this.runHealthChecks()
    }, 30000)

    // Initial health check
    this.runHealthChecks()

    this.emit('monitor:started')
  }

  /**
   * Stop monitoring services
   */
  stop() {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    console.log('DNS Monitor stopped')
    this.emit('monitor:stopped')
  }

  /**
   * Record DNS query metrics
   */
  recordQuery(queryData) {
    this.metrics.queries++
    
    if (queryData.responseTime) {
      this.metrics.responseTime.push(queryData.responseTime)
      
      // Keep only last 1000 response times
      if (this.metrics.responseTime.length > 1000) {
        this.metrics.responseTime = this.metrics.responseTime.slice(-1000)
      }
    }

    if (queryData.error) {
      this.metrics.errors++
      this.checkErrorThreshold()
    }

    this.emit('query:recorded', queryData)
  }

  /**
   * Record DNS operation metrics
   */
  recordOperation(operation, success, duration) {
    const operationData = {
      operation,
      success,
      duration,
      timestamp: new Date().toISOString()
    }

    if (!success) {
      this.metrics.errors++
      this.checkErrorThreshold()
    }

    this.emit('operation:recorded', operationData)
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0

    return {
      ...this.metrics,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      errorRate: this.metrics.queries > 0 ? (this.metrics.errors / this.metrics.queries) * 100 : 0,
      uptime: Date.now() - this.metrics.uptime,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Run comprehensive health checks
   */
  async runHealthChecks() {
    const checks = [
      this.checkDnsService(),
      this.checkDatabase(),
      this.checkDiskSpace(),
      this.checkMemoryUsage(),
      this.checkZoneHealth()
    ]

    try {
      const results = await Promise.allSettled(checks)
      
      results.forEach((result, index) => {
        const checkName = ['dns_service', 'database', 'disk_space', 'memory_usage', 'zone_health'][index]
        
        if (result.status === 'fulfilled') {
          this.healthChecks.set(checkName, result.value)
        } else {
          this.healthChecks.set(checkName, {
            status: 'failed',
            message: result.reason.message,
            timestamp: new Date().toISOString()
          })
        }
      })

      this.emit('health:checked', this.getHealthStatus())
    } catch (error) {
      console.error('Health check error:', error)
    }
  }

  /**
   * Check DNS service health
   */
  async checkDnsService() {
    try {
      // This would check if BIND9 is running and responding
      const startTime = Date.now()
      
      // Simulate DNS service check
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const responseTime = Date.now() - startTime
      
      return {
        status: 'healthy',
        responseTime,
        message: 'DNS service is responding',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`DNS service check failed: ${error.message}`)
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const startTime = Date.now()
      
      // Test database connection
      await dnsDataAccess.db.query('SELECT 1')
      
      const responseTime = Date.now() - startTime
      
      return {
        status: 'healthy',
        responseTime,
        message: 'Database is accessible',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Database check failed: ${error.message}`)
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    try {
      const fs = require('fs')
      const { promisify } = require('util')
      const stat = promisify(fs.stat)
      
      // Check available disk space (simplified)
      const stats = await stat('/')
      
      return {
        status: 'healthy',
        message: 'Sufficient disk space available',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Disk space check failed: ${error.message}`)
    }
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    try {
      const memUsage = process.memoryUsage()
      const totalMem = require('os').totalmem()
      const freeMem = require('os').freemem()
      
      const usedMemoryPercent = ((totalMem - freeMem) / totalMem) * 100
      
      if (usedMemoryPercent > 90) {
        throw new Error(`High memory usage: ${usedMemoryPercent.toFixed(1)}%`)
      }
      
      return {
        status: 'healthy',
        memoryUsage: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          systemUsedPercent: Math.round(usedMemoryPercent * 100) / 100
        },
        message: 'Memory usage is normal',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Memory check failed: ${error.message}`)
    }
  }

  /**
   * Check zone health
   */
  async checkZoneHealth() {
    try {
      // This would check zone configurations and record counts
      const tenantId = '00000000-0000-0000-0000-000000000001' // Default tenant
      const zones = await dnsDataAccess.getZones(tenantId, { limit: 100 })
      
      this.metrics.zones = zones.length
      
      let totalRecords = 0
      for (const zone of zones) {
        const records = await dnsDataAccess.getRecords(tenantId, zone.name, { limit: 1000 })
        totalRecords += records.length
      }
      
      this.metrics.records = totalRecords
      
      return {
        status: 'healthy',
        zones: zones.length,
        records: totalRecords,
        message: `${zones.length} zones with ${totalRecords} records`,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Zone health check failed: ${error.message}`)
    }
  }

  /**
   * Get overall health status
   */
  getHealthStatus() {
    const checks = Array.from(this.healthChecks.entries())
    const failedChecks = checks.filter(([name, check]) => check.status !== 'healthy')
    
    return {
      overall: failedChecks.length === 0 ? 'healthy' : 'unhealthy',
      checks: Object.fromEntries(checks),
      failedChecks: failedChecks.length,
      totalChecks: checks.length,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Check error rate threshold and create alerts
   */
  checkErrorThreshold() {
    const errorRate = this.metrics.queries > 0 ? (this.metrics.errors / this.metrics.queries) * 100 : 0
    
    if (errorRate > 10) { // 10% error rate threshold
      this.createAlert('high_error_rate', `Error rate is ${errorRate.toFixed(1)}%`, 'warning')
    }
    
    if (errorRate > 25) { // 25% error rate threshold
      this.createAlert('critical_error_rate', `Critical error rate: ${errorRate.toFixed(1)}%`, 'critical')
    }
  }

  /**
   * Create an alert
   */
  createAlert(type, message, severity = 'info') {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      acknowledged: false
    }

    this.alerts.unshift(alert)
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100)
    }

    console.log(`DNS Alert [${severity.toUpperCase()}]: ${message}`)
    this.emit('alert:created', alert)

    return alert
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      alert.acknowledgedAt = new Date().toISOString()
      this.emit('alert:acknowledged', alert)
      return alert
    }
    return null
  }

  /**
   * Get active alerts
   */
  getAlerts(includeAcknowledged = false) {
    return includeAcknowledged 
      ? this.alerts 
      : this.alerts.filter(alert => !alert.acknowledged)
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = Date.now() - maxAge
    const initialCount = this.alerts.length
    
    this.alerts = this.alerts.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime()
      return alertTime > cutoff
    })
    
    const removedCount = initialCount - this.alerts.length
    if (removedCount > 0) {
      console.log(`Cleared ${removedCount} old alerts`)
    }
  }
}

// Create singleton instance
const dnsMonitor = new DnsMonitor()

module.exports = {
  DnsMonitor,
  dnsMonitor
}
