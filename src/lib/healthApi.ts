import { api } from './api'
import { DnsApi } from './dnsApi'
import { Kea } from './keaApi'
import { HealthStatus } from '../components/HealthTile'

/**
 * Health monitoring API for various services
 */
export const HealthApi = {
  // Get overall system health
  async getSystemHealth(): Promise<HealthStatus[]> {
    try {
      return await api<HealthStatus[]>('/health', 'GET')
    } catch (error) {
      // Fallback to individual service checks if centralized health endpoint is not available
      return await this.getIndividualHealthChecks()
    }
  },

  // Individual service health checks
  async getIndividualHealthChecks(): Promise<HealthStatus[]> {
    const checks = await Promise.allSettled([
      this.checkKeaHealth(),
      this.checkBindHealth(),
      this.checkDdnsHealth(),
      this.checkPostgresHealth(),
      this.checkAgentHealth()
    ])

    return checks.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        const services = ['Kea DHCP', 'BIND DNS', 'DDNS', 'PostgreSQL', 'Kea Pilot Agent']
        return {
          service: services[index],
          status: 'error' as const,
          message: 'Health check failed',
          lastCheck: new Date().toISOString()
        }
      }
    })
  },

  // Kea DHCP health check
  async checkKeaHealth(): Promise<HealthStatus> {
    try {
      const config = await Kea.configGet()
      const version = await this.getKeaVersion()
      
      return {
        service: 'Kea DHCP',
        status: 'healthy',
        message: 'DHCP server is running',
        version: version || 'Unknown',
        lastCheck: new Date().toISOString(),
        details: {
          'Subnets': config?.Dhcp4?.subnet4?.length || 0,
          'Interfaces': config?.Dhcp4?.interfaces?.length || 0
        }
      }
    } catch (error) {
      return {
        service: 'Kea DHCP',
        status: 'error',
        message: 'Unable to connect to Kea DHCP server',
        lastCheck: new Date().toISOString()
      }
    }
  },

  // BIND DNS health check
  async checkBindHealth(): Promise<HealthStatus> {
    try {
      const status = await DnsApi.getStatus()
      let stats = null

      // Only try to get statistics if DNS is running
      if (status.running) {
        try {
          stats = await DnsApi.getStatistics()
        } catch (error) {
          // Statistics endpoint might not be available, continue without it
          console.warn('DNS statistics not available:', error)
        }
      }

      return {
        service: 'BIND DNS',
        status: status.running ? 'healthy' : 'warning',
        message: status.running ? 'DNS server is running' : (status.message || 'DNS server not running'),
        version: status.version || 'Unknown',
        lastCheck: new Date().toISOString(),
        details: {
          'Zones': status.zones || 0,
          'Config Time': status.configTime || 'Unknown',
          'Boot Time': status.bootTime || 'Unknown',
          'Queries': stats?.queries || 0
        }
      }
    } catch (error) {
      return {
        service: 'BIND DNS',
        status: 'error',
        message: 'Unable to connect to BIND DNS server',
        lastCheck: new Date().toISOString()
      }
    }
  },

  // DDNS health check
  async checkDdnsHealth(): Promise<HealthStatus> {
    try {
      const status = await DnsApi.getDdnsStatus()

      const isHealthy = status.d2Running && status.bindRunning

      return {
        service: 'DDNS',
        status: isHealthy ? 'healthy' : 'warning',
        message: isHealthy ? 'DDNS service is running' : (status.message || 'DDNS service issues detected'),
        lastCheck: new Date().toISOString(),
        details: {
          'D2 Daemon': status.d2Running ? 'Running' : 'Stopped',
          'BIND Integration': status.bindRunning ? 'Active' : 'Inactive',
          'Last Update': status.lastUpdate || 'Unknown'
        }
      }
    } catch (error) {
      return {
        service: 'DDNS',
        status: 'error',
        message: 'Unable to check DDNS status',
        lastCheck: new Date().toISOString()
      }
    }
  },

  // PostgreSQL health check
  async checkPostgresHealth(): Promise<HealthStatus> {
    try {
      const result = await api('/health/postgres', 'GET')
      
      return {
        service: 'PostgreSQL',
        status: result.connected ? 'healthy' : 'error',
        message: result.connected ? 'Database is connected' : 'Database connection failed',
        version: result.version || 'Unknown',
        lastCheck: new Date().toISOString(),
        details: {
          'Connections': result.connections || 0,
          'Database': result.database || 'Unknown'
        }
      }
    } catch (error) {
      return {
        service: 'PostgreSQL',
        status: 'error',
        message: 'Unable to connect to PostgreSQL database',
        lastCheck: new Date().toISOString()
      }
    }
  },

  // Kea Pilot Agent health check
  async checkAgentHealth(): Promise<HealthStatus> {
    try {
      const result = await api('/health/agent', 'GET')

      return {
        service: 'Kea Pilot Agent',
        status: result.status === 'running' ? 'healthy' : 'warning',
        message: result.status === 'running' ? 'Agent is running' : 'Agent status unknown',
        version: result.version || 'Unknown',
        uptime: result.uptime || 'Unknown',
        lastCheck: new Date().toISOString(),
        details: {
          'CPU': result.cpu ? `${result.cpu}%` : 'Unknown',
          'Memory': result.memory ? `${result.memory}%` : 'Unknown'
        }
      }
    } catch (error) {
      return {
        service: 'Kea Pilot Agent',
        status: 'error',
        message: 'Unable to connect to Kea Pilot Agent',
        lastCheck: new Date().toISOString()
      }
    }
  },

  // Helper to get Kea version
  async getKeaVersion(): Promise<string | null> {
    try {
      const result = await api('/kea/version', 'GET')
      return result.version || null
    } catch (error) {
      return null
    }
  }
}
