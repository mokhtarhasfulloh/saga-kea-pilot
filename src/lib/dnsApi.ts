import { api } from './api'
import { ZoneT, DnsRecordT, ZoneListResponseT, RecordListResponseT, DnsActionResponseT } from './schemas/dns'

/**
 * DNS API client for BIND9 management
 * Provides methods for zone and record management with validation
 */
export const DnsApi = {
  // Zone management
  async getZones(): Promise<ZoneListResponseT> {
    return await api<ZoneListResponseT>('/dns/zones', 'GET')
  },

  async getZone(zoneName: string): Promise<ZoneT> {
    return await api<ZoneT>(`/dns/zones/${encodeURIComponent(zoneName)}`, 'GET')
  },

  async createZone(zone: {
    name: string
    type?: 'master' | 'slave' | 'forward'
    primaryNs?: string
    adminEmail?: string
    serial?: number
  }): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>('/dns/zones', 'POST', zone)
  },

  async updateZone(zoneName: string, updates: {
    primaryNs?: string
    adminEmail?: string
    serial?: number
  }): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}`, 'PUT', updates)
  },

  async deleteZone(zoneName: string): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}`, 'DELETE')
  },

  // Record management
  async getRecords(zoneName: string, limit = 50, offset = 0): Promise<RecordListResponseT> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    })
    return await api<RecordListResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/records?${params}`, 'GET')
  },

  async createRecord(zoneName: string, record: Omit<DnsRecordT, 'zone'>): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/records`, 'POST', record)
  },

  async updateRecord(zoneName: string, recordName: string, recordType: string, record: Partial<DnsRecordT>): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/records/${encodeURIComponent(recordName)}/${encodeURIComponent(recordType)}`, 'PUT', record)
  },

  async deleteRecord(zoneName: string, recordName: string, recordType: string): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/records/${encodeURIComponent(recordName)}/${encodeURIComponent(recordType)}`, 'DELETE')
  },

  // Zone validation and management
  async validateZone(zoneName: string): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/validate`, 'POST')
  },

  async reloadZone(zoneName: string): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/reload`, 'POST')
  },

  async reloadConfig(): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>('/dns/reload', 'POST')
  },

  // Bulk operations
  async bulkCreateRecords(zoneName: string, records: Omit<DnsRecordT, 'zone'>[]): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/records/bulk`, 'POST', { records })
  },

  async bulkUpdateRecords(zoneName: string, records: Partial<DnsRecordT>[]): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/records/bulk`, 'PUT', { records })
  },

  async bulkDeleteRecords(zoneName: string, records: { name: string; type: string }[]): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/records/bulk`, 'DELETE', { records })
  },

  // Import/Export
  async importRecords(zoneName: string, zoneFileContent: string, format = 'bind'): Promise<DnsActionResponseT> {
    return await api<DnsActionResponseT>(`/dns/zones/${encodeURIComponent(zoneName)}/import`, 'POST', { zoneFileContent, format })
  },

  async exportRecords(zoneName: string, format = 'bind'): Promise<any> {
    const params = new URLSearchParams({ format })
    if (format === 'bind') {
      // For BIND format, we get the raw zone file content
      const response = await fetch(`/api/dns/zones/${encodeURIComponent(zoneName)}/export?${params}`)
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }
      return await response.text()
    } else {
      // For JSON format, we get structured data
      return await api(`/dns/zones/${encodeURIComponent(zoneName)}/export?${params}`, 'GET')
    }
  },

  // Statistics and status
  async getStatus(): Promise<{ running: boolean; version?: string; zones?: number; configTime?: string; bootTime?: string; message?: string }> {
    return await api('/dns/status', 'GET')
  },

  async getDdnsStatus(): Promise<{ d2Running: boolean; bindRunning: boolean; lastUpdate: string; message?: string; stats?: any }> {
    return await api('/dns/ddns/status', 'GET')
  },

  async getStatistics(): Promise<Record<string, any>> {
    return await api('/dns/statistics', 'GET')
  },

  // DNS Query Testing
  async performDnsQuery(name: string, type: string, server: string): Promise<any> {
    return await api('/dns/query', 'POST', { name, type, server })
  },

  // Dynamic DNS (DDNS) Methods
  async getDdnsConfig(): Promise<any> {
    return await api('/dns/ddns/config', 'GET')
  },

  async updateDdnsConfig(config: any): Promise<any> {
    return await api('/dns/ddns/config', 'PUT', config)
  },

  async generateTsigKey(keyName: string, algorithm?: string): Promise<any> {
    return await api('/dns/ddns/tsig-key', 'POST', { keyName, algorithm })
  },

  async listTsigKeys(): Promise<any> {
    return await api('/dns/ddns/tsig-keys', 'GET')
  },

  async deleteTsigKey(keyName: string): Promise<any> {
    return await api(`/dns/ddns/tsig-keys/${encodeURIComponent(keyName)}`, 'DELETE')
  },

  async ddnsUpdate(zone: string, name: string, type: string, value: string, ttl?: number, tsigKey?: string, tsigSignature?: string): Promise<any> {
    return await api('/dns/ddns/update', 'POST', { zone, name, type, value, ttl, tsigKey, tsigSignature })
  },

  async getDdnsHistory(zone?: string, limit?: number): Promise<any> {
    const params = new URLSearchParams()
    if (zone) params.append('zone', zone)
    if (limit) params.append('limit', limit.toString())

    const queryString = params.toString()
    return await api(`/dns/ddns/history${queryString ? '?' + queryString : ''}`, 'GET')
  },

  // Advanced Zone Management
  async getZoneTemplates(): Promise<any> {
    return await api('/dns/zone-templates', 'GET')
  },

  async createZoneFromTemplate(templateId: string, zoneName: string, variables: Record<string, string>): Promise<any> {
    return await api('/dns/zones/from-template', 'POST', { templateId, zoneName, variables })
  },

  async cloneZone(sourceZone: string, targetZone: string, includeRecords = true): Promise<any> {
    return await api(`/dns/zones/${encodeURIComponent(sourceZone)}/clone`, 'POST', { targetZone, includeRecords })
  },

  async advancedZoneValidation(zoneName: string, options: { checkDnssec?: boolean; checkDelegation?: boolean } = {}): Promise<any> {
    return await api(`/dns/zones/${encodeURIComponent(zoneName)}/validate-advanced`, 'POST', options)
  },

  async getZoneDependencies(zoneName: string): Promise<any> {
    return await api(`/dns/zones/${encodeURIComponent(zoneName)}/dependencies`, 'GET')
  },

  async bulkZoneOperation(operation: string, zones: string[], options: Record<string, any> = {}): Promise<any> {
    return await api('/dns/zones/bulk-operation', 'POST', { operation, zones, options })
  }
}
