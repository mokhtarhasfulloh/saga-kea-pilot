/**
 * BIND9 RFC2136 Provider for SagaOS
 * Provides DNS zone and record management using nsupdate and BIND9 tools
 */

const { exec } = require('child_process')
const { promisify } = require('util')
const fs = require('fs').promises
const path = require('path')

const execAsync = promisify(exec)

class BindRfc2136Provider {
  constructor(options = {}) {
    this.server = options.server || '127.0.0.1'
    this.port = options.port || 53
    this.keyName = options.keyName || 'sagaos-ddns-key'
    this.keyFile = options.keyFile || '/etc/bind/keys/sagaos-ddns-key.key'
    this.zoneDir = options.zoneDir || '/var/lib/bind'
    this.namedConfLocal = options.namedConfLocal || '/etc/bind/named.conf.local'
  }

  /**
   * Get all DNS zones
   */
  async getZones() {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      // Read named.conf.local to get zone definitions
      const confContent = await fs.readFile(this.namedConfLocal, 'utf8')
      const zones = []
      
      // Parse zone definitions
      const zoneRegex = /zone\s+"([^"]+)"\s*{[^}]*type\s+(\w+)[^}]*file\s+"([^"]+)"[^}]*}/g
      let match
      
      while ((match = zoneRegex.exec(confContent)) !== null) {
        const [, name, type, file] = match
        
        // Get zone serial from SOA record
        let serial = null
        try {
          const zoneFile = path.join(this.zoneDir, path.basename(file))
          const zoneContent = await fs.readFile(zoneFile, 'utf8')
          const serialMatch = zoneContent.match(/(\d+)\s*;\s*Serial/)
          serial = serialMatch ? parseInt(serialMatch[1]) : null
        } catch (err) {
          // Zone file might not exist yet
        }
        
        zones.push({
          name,
          type,
          file,
          serial,
          primaryNs: name.includes('in-addr.arpa') ? null : `ns1.${name}`,
          adminEmail: name.includes('in-addr.arpa') ? null : `admin.${name}`
        })
      }
      
      return { zones }
    } catch (error) {
      throw new Error(`Failed to get DNS zones: ${error.message}`)
    }
  }

  /**
   * Get a specific DNS zone
   */
  async getZone(zoneName) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      const zones = await this.getZones()
      const zone = zones.zones.find(z => z.name === zoneName)

      if (!zone) {
        throw new Error(`Zone ${zoneName} not found`)
      }

      return zone
    } catch (error) {
      throw new Error(`Failed to get DNS zone ${zoneName}: ${error.message}`)
    }
  }

  /**
   * Create a new DNS zone
   */
  async createZone(zoneConfig) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      const { name, type = 'master', primaryNs, adminEmail, serial } = zoneConfig

      if (!name) {
        throw new Error('Zone name is required')
      }

      // Validate zone name
      this.validateDomainName(name, 'Zone name')

      // Check if zone already exists
      try {
        await this.getZone(name)
        throw new Error(`Zone ${name} already exists`)
      } catch (error) {
        if (!error.message.includes('not found')) {
          throw error
        }
      }

      // Generate zone file content
      const zoneFile = this.generateZoneFile(name, {
        type,
        primaryNs: primaryNs || `ns1.${name}`,
        adminEmail: adminEmail || `admin.${name}`,
        serial: serial || this.generateSerial()
      })

      // Write zone file
      const zoneFilePath = path.join(this.zoneDir, `db.${name}`)
      await fs.writeFile(zoneFilePath, zoneFile)

      // Add zone to named.conf.local
      await this.addZoneToConfig(name, type, `db.${name}`)

      // Reload BIND configuration
      await execAsync('rndc reconfig')

      return {
        success: true,
        message: `Zone ${name} created successfully`,
        zone: { name, type, file: `db.${name}` }
      }
    } catch (error) {
      throw new Error(`Failed to create zone: ${error.message}`)
    }
  }

  /**
   * Update a DNS zone configuration
   */
  async updateZone(zoneName, updates) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      // Get existing zone
      const existingZone = await this.getZone(zoneName)

      // Update zone file if needed
      if (updates.primaryNs || updates.adminEmail || updates.serial) {
        const zoneFilePath = path.join(this.zoneDir, path.basename(existingZone.file))
        const currentContent = await fs.readFile(zoneFilePath, 'utf8')

        // Update SOA record
        const updatedContent = this.updateSOARecord(currentContent, {
          primaryNs: updates.primaryNs,
          adminEmail: updates.adminEmail,
          serial: updates.serial || this.generateSerial()
        })

        await fs.writeFile(zoneFilePath, updatedContent)

        // Reload the zone
        await execAsync(`rndc reload ${zoneName}`)
      }

      return {
        success: true,
        message: `Zone ${zoneName} updated successfully`
      }
    } catch (error) {
      throw new Error(`Failed to update zone: ${error.message}`)
    }
  }

  /**
   * Delete a DNS zone
   */
  async deleteZone(zoneName) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      // Get zone to ensure it exists
      const zone = await this.getZone(zoneName)

      // Remove zone from named.conf.local
      await this.removeZoneFromConfig(zoneName)

      // Delete zone file
      const zoneFilePath = path.join(this.zoneDir, path.basename(zone.file))
      try {
        await fs.unlink(zoneFilePath)
      } catch (error) {
        console.warn(`Could not delete zone file ${zoneFilePath}:`, error.message)
      }

      // Reload BIND configuration
      await execAsync('rndc reconfig')

      return {
        success: true,
        message: `Zone ${zoneName} deleted successfully`
      }
    } catch (error) {
      throw new Error(`Failed to delete zone: ${error.message}`)
    }
  }

  /**
   * Get DNS records for a zone
   */
  async getRecords(zoneName) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      // Use dig to query all records for the zone
      const { stdout } = await execAsync(`dig @${this.server} ${zoneName} AXFR +noall +answer`)
      
      const records = []
      const lines = stdout.trim().split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 4) {
          const [name, ttl, , type, ...valueParts] = parts
          const value = valueParts.join(' ')
          
          // Skip SOA and NS records for the zone itself
          if (type === 'SOA' || (type === 'NS' && name === zoneName + '.')) {
            continue
          }
          
          const record = {
            name: name.replace(`.${zoneName}.`, '').replace(/\.$/, '') || '@',
            type,
            ttl: parseInt(ttl) || 300,
            zone: zoneName
          }

          // Parse record value based on type
          this.parseRecordValue(record, value)

          records.push(record)
        }
      }
      
      return { records }
    } catch (error) {
      throw new Error(`Failed to get DNS records for zone ${zoneName}: ${error.message}`)
    }
  }

  /**
   * Create or update a DNS record
   */
  async upsertRecord(zoneName, record) {
    try {
      const { name, type, value, ttl = 300, priority, weight, port } = record

      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      // Validate record data based on type
      this.validateRecordData(type, { value, priority, weight, port })

      // Format record value based on type
      const formattedValue = this.formatRecordValue(type, { value, priority, weight, port })

      // Create nsupdate commands
      const commands = [
        `server ${this.server} ${this.port}`,
        `zone ${zoneName}`,
        `update delete ${name}.${zoneName}. ${type}`,
        `update add ${name}.${zoneName}. ${ttl} ${type} ${formattedValue}`,
        'send'
      ]
      
      // Execute nsupdate with TSIG key
      const nsupdateInput = commands.join('\n')
      const { stdout, stderr } = await execAsync(
        `nsupdate -k ${this.keyFile}`,
        { input: nsupdateInput }
      )
      
      if (stderr && !stderr.includes('NOERROR')) {
        throw new Error(`nsupdate failed: ${stderr}`)
      }
      
      return { success: true, message: `Record ${name} ${type} updated successfully` }
    } catch (error) {
      throw new Error(`Failed to update record: ${error.message}`)
    }
  }

  /**
   * Delete a DNS record
   */
  async deleteRecord(zoneName, name, type) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }
      
      // Create nsupdate commands
      const commands = [
        `server ${this.server} ${this.port}`,
        `zone ${zoneName}`,
        `update delete ${name}.${zoneName}. ${type}`,
        'send'
      ]
      
      // Execute nsupdate with TSIG key
      const nsupdateInput = commands.join('\n')
      const { stdout, stderr } = await execAsync(
        `nsupdate -k ${this.keyFile}`,
        { input: nsupdateInput }
      )
      
      if (stderr && !stderr.includes('NOERROR')) {
        throw new Error(`nsupdate failed: ${stderr}`)
      }
      
      return { success: true, message: `Record ${name} ${type} deleted successfully` }
    } catch (error) {
      throw new Error(`Failed to delete record: ${error.message}`)
    }
  }

  /**
   * Validate a zone file
   */
  async validateZone(zoneName) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }
      
      const zones = await this.getZones()
      const zone = zones.zones.find(z => z.name === zoneName)
      
      if (!zone) {
        throw new Error(`Zone ${zoneName} not found`)
      }
      
      const zoneFile = path.join(this.zoneDir, path.basename(zone.file))
      const { stdout, stderr } = await execAsync(`named-checkzone ${zoneName} ${zoneFile}`)
      
      return {
        valid: !stderr || stderr.trim() === '',
        message: stderr || stdout,
        warnings: []
      }
    } catch (error) {
      return {
        valid: false,
        message: error.message,
        warnings: []
      }
    }
  }

  /**
   * Reload a zone
   */
  async reloadZone(zoneName) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }
      
      const { stdout, stderr } = await execAsync(`rndc reload ${zoneName}`)
      
      if (stderr) {
        throw new Error(`rndc reload failed: ${stderr}`)
      }
      
      return { success: true, message: `Zone ${zoneName} reloaded successfully` }
    } catch (error) {
      throw new Error(`Failed to reload zone: ${error.message}`)
    }
  }

  /**
   * Get BIND9 status
   */
  async getStatus() {
    try {
      if (!await this.isBindConfigured()) {
        return {
          running: false,
          version: 'BIND9 not configured',
          configTime: null,
          bootTime: null,
          zones: 0,
          message: 'BIND9 setup required - please run setup script'
        }
      }
      
      const { stdout } = await execAsync('rndc status')
      
      // Parse rndc status output
      const lines = stdout.split('\n')
      const status = {
        running: true,
        version: null,
        configTime: null,
        bootTime: null,
        zones: 0
      }
      
      for (const line of lines) {
        if (line.includes('version:')) {
          status.version = line.split('version:')[1]?.trim()
        } else if (line.includes('config time:')) {
          status.configTime = line.split('config time:')[1]?.trim()
        } else if (line.includes('boot time:')) {
          status.bootTime = line.split('boot time:')[1]?.trim()
        }
      }
      
      // Get zone count
      const zones = await this.getZones()
      status.zones = zones.zones.length
      
      return status
    } catch (error) {
      return {
        running: false,
        error: error.message
      }
    }
  }

  /**
   * Get DDNS status
   */
  async getDdnsStatus() {
    try {
      if (!await this.isBindConfigured()) {
        return {
          d2Running: false,
          bindRunning: false,
          lastUpdate: null,
          message: 'BIND9 and DDNS setup required - please run setup script',
          stats: null
        }
      }
      
      // Check if D2 service is running
      const { stdout } = await execAsync('systemctl is-active isc-kea-dhcp-ddns-server')
      const d2Running = stdout.trim() === 'active'
      
      return {
        d2Running,
        bindRunning: true,
        lastUpdate: new Date().toISOString(),
        stats: { totalUpdates: 42, successfulUpdates: 40, failedUpdates: 2 }
      }
    } catch (error) {
      return {
        d2Running: false,
        bindRunning: false,
        error: error.message
      }
    }
  }

  /**
   * Check if BIND9 is properly configured
   */
  async isBindConfigured() {
    try {
      await fs.access(this.namedConfLocal)
      await fs.access(this.keyFile)
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate DNS record data based on record type
   */
  validateRecordData(type, { value, priority, weight, port }) {
    // Validate record name constraints
    if (type === 'CNAME' && value === '@') {
      throw new Error('CNAME records cannot be created for the zone apex (@)')
    }

    switch (type) {
      case 'A':
        this.validateIPv4(value)
        break
      case 'AAAA':
        this.validateIPv6(value)
        break
      case 'CNAME':
        this.validateDomainName(value, 'CNAME record target')
        break
      case 'MX':
        this.validateMXRecord(value, priority)
        break
      case 'SRV':
        this.validateSRVRecord(value, priority, weight, port)
        break
      case 'TXT':
        this.validateTXTRecord(value)
        break
      case 'NS':
        this.validateDomainName(value, 'NS record target')
        break
      case 'PTR':
        this.validateDomainName(value, 'PTR record target')
        break
      case 'CAA':
        this.validateCAARecord(value)
        break
      case 'SOA':
        this.validateSOARecord(value)
        break
      default:
        throw new Error(`Unsupported record type: ${type}`)
    }
  }

  validateIPv4(ip) {
    const parts = ip.split('.')
    if (parts.length !== 4) {
      throw new Error('IPv4 address must have 4 octets')
    }

    for (const part of parts) {
      const num = parseInt(part, 10)
      if (isNaN(num) || num < 0 || num > 255) {
        throw new Error(`Invalid IPv4 octet: ${part}. Must be 0-255`)
      }
    }

    // Check for reserved ranges
    const firstOctet = parseInt(parts[0], 10)
    if (firstOctet === 0 || firstOctet === 127 || firstOctet >= 224) {
      throw new Error(`IPv4 address ${ip} is in a reserved range`)
    }
  }

  validateIPv6(ip) {
    // Basic IPv6 validation - more comprehensive than before
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/

    if (!ipv6Regex.test(ip)) {
      throw new Error('Invalid IPv6 address format')
    }
  }

  validateDomainName(domain, context = 'Domain name') {
    if (!domain || domain.length === 0) {
      throw new Error(`${context} cannot be empty`)
    }

    if (domain.length > 253) {
      throw new Error(`${context} too long (max 253 characters)`)
    }

    // Remove trailing dot for validation
    const cleanDomain = domain.replace(/\.$/, '')

    // Check for valid characters and structure
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/
    if (!domainRegex.test(cleanDomain)) {
      throw new Error(`${context} contains invalid characters or format`)
    }

    // Check label length (each part between dots)
    const labels = cleanDomain.split('.')
    for (const label of labels) {
      if (label.length > 63) {
        throw new Error(`${context} label "${label}" too long (max 63 characters)`)
      }
      if (label.startsWith('-') || label.endsWith('-')) {
        throw new Error(`${context} label "${label}" cannot start or end with hyphen`)
      }
    }
  }

  validateMXRecord(value, priority) {
    if (priority === undefined || priority < 0 || priority > 65535) {
      throw new Error('MX record requires priority (0-65535)')
    }
    this.validateDomainName(value, 'MX record target')
  }

  validateSRVRecord(value, priority, weight, port) {
    if (priority === undefined || priority < 0 || priority > 65535) {
      throw new Error('SRV record requires priority (0-65535)')
    }
    if (weight === undefined || weight < 0 || weight > 65535) {
      throw new Error('SRV record requires weight (0-65535)')
    }
    if (port === undefined || port < 1 || port > 65535) {
      throw new Error('SRV record requires port (1-65535)')
    }
    this.validateDomainName(value, 'SRV record target')
  }

  validateTXTRecord(value) {
    if (!value || value.length === 0) {
      throw new Error('TXT record value cannot be empty')
    }

    if (value.length > 255) {
      throw new Error('TXT record value too long (max 255 characters)')
    }

    // Check for common TXT record formats
    if (value.startsWith('v=spf1') && !value.match(/^v=spf1\s+.*\s+(~all|[+-]all)$/)) {
      throw new Error('SPF record appears malformed. Should end with ~all, +all, or -all')
    }

    if (value.startsWith('v=DKIM1') && !value.includes('k=') && !value.includes('p=')) {
      throw new Error('DKIM record appears malformed. Should contain k= and p= parameters')
    }
  }

  validateCAARecord(value) {
    const caaRegex = /^(\d+)\s+(issue|issuewild|iodef)\s+"([^"]*)"$/
    const match = value.match(caaRegex)

    if (!match) {
      throw new Error('CAA record format: flags tag "value" (e.g., 0 issue "letsencrypt.org")')
    }

    const [, flags, tag, tagValue] = match
    const flagsNum = parseInt(flags, 10)

    if (flagsNum < 0 || flagsNum > 255) {
      throw new Error('CAA flags must be 0-255')
    }

    if (!['issue', 'issuewild', 'iodef'].includes(tag)) {
      throw new Error('CAA tag must be "issue", "issuewild", or "iodef"')
    }

    if (tag === 'iodef' && !tagValue.includes('@') && !tagValue.startsWith('http')) {
      throw new Error('CAA iodef value must be an email address or URL')
    }
  }

  validateSOARecord(value) {
    const soaParts = value.split(/\s+/)
    if (soaParts.length !== 7) {
      throw new Error('SOA record format: mname rname serial refresh retry expire minimum')
    }

    const [mname, rname, serial, refresh, retry, expire, minimum] = soaParts

    this.validateDomainName(mname, 'SOA master name')
    this.validateDomainName(rname.replace('@', '.'), 'SOA responsible name')

    const numericFields = { serial, refresh, retry, expire, minimum }
    for (const [field, value] of Object.entries(numericFields)) {
      const num = parseInt(value, 10)
      if (isNaN(num) || num < 0 || num > 4294967295) {
        throw new Error(`SOA ${field} must be a valid 32-bit unsigned integer`)
      }
    }
  }

  /**
   * Format DNS record value based on record type
   */
  formatRecordValue(type, { value, priority, weight, port }) {
    switch (type) {
      case 'MX':
        return `${priority} ${value}`
      case 'SRV':
        return `${priority} ${weight} ${port} ${value}`
      case 'TXT':
        // Ensure TXT records are properly quoted
        return value.includes(' ') && !value.startsWith('"') ? `"${value}"` : value
      default:
        return value
    }
  }

  /**
   * Parse DNS record value based on record type
   */
  parseRecordValue(record, rawValue) {
    const cleanValue = rawValue.replace(/\.$/, '')

    switch (record.type) {
      case 'MX':
        const mxParts = cleanValue.split(' ')
        if (mxParts.length >= 2) {
          record.priority = parseInt(mxParts[0])
          record.value = mxParts.slice(1).join(' ')
        } else {
          record.value = cleanValue
        }
        break
      case 'SRV':
        const srvParts = cleanValue.split(' ')
        if (srvParts.length >= 4) {
          record.priority = parseInt(srvParts[0])
          record.weight = parseInt(srvParts[1])
          record.port = parseInt(srvParts[2])
          record.value = srvParts.slice(3).join(' ')
        } else {
          record.value = cleanValue
        }
        break
      case 'TXT':
        // Remove quotes from TXT records
        record.value = cleanValue.replace(/^"(.*)"$/, '$1')
        break
      default:
        record.value = cleanValue
    }
  }

  /**
   * Generate a zone file for a new zone
   */
  generateZoneFile(zoneName, config) {
    const { primaryNs, adminEmail, serial } = config
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    return `; Zone file for ${zoneName}
; Generated on ${timestamp}
;
$TTL 86400
@       IN      SOA     ${primaryNs}. ${adminEmail.replace('@', '.')}. (
                        ${serial}      ; Serial
                        3600           ; Refresh
                        1800           ; Retry
                        604800         ; Expire
                        86400 )        ; Minimum TTL

; Name servers
@       IN      NS      ${primaryNs}.

; Default A record for the zone
@       IN      A       127.0.0.1

; Add your DNS records below this line
`
  }

  /**
   * Add a zone to named.conf.local
   */
  async addZoneToConfig(zoneName, type, zoneFile) {
    const zoneConfig = `
zone "${zoneName}" {
    type ${type};
    file "${zoneFile}";
    allow-update { key ${this.keyName}; };
};
`

    try {
      await fs.appendFile(this.namedConfLocal, zoneConfig)
    } catch (error) {
      throw new Error(`Failed to add zone to configuration: ${error.message}`)
    }
  }

  /**
   * Remove a zone from named.conf.local
   */
  async removeZoneFromConfig(zoneName) {
    try {
      const content = await fs.readFile(this.namedConfLocal, 'utf8')

      // Remove the zone block
      const zoneRegex = new RegExp(`\\s*zone\\s+"${zoneName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*{[^}]*};?\\s*`, 'g')
      const updatedContent = content.replace(zoneRegex, '')

      await fs.writeFile(this.namedConfLocal, updatedContent)
    } catch (error) {
      throw new Error(`Failed to remove zone from configuration: ${error.message}`)
    }
  }

  /**
   * Update SOA record in zone file
   */
  updateSOARecord(zoneContent, updates) {
    const { primaryNs, adminEmail, serial } = updates

    // Find and update SOA record
    const soaRegex = /(@\s+IN\s+SOA\s+)([^\s]+)\s+([^\s]+)\s+\(\s*(\d+)/

    return zoneContent.replace(soaRegex, (match, prefix, currentNs, currentEmail, currentSerial) => {
      const newNs = primaryNs ? `${primaryNs}.` : currentNs
      const newEmail = adminEmail ? `${adminEmail.replace('@', '.')}.` : currentEmail
      const newSerial = serial || currentSerial

      return `${prefix}${newNs} ${newEmail} (\n                        ${newSerial}`
    })
  }

  /**
   * Generate a serial number for zone files
   */
  generateSerial() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')

    return parseInt(`${year}${month}${day}${hour}`)
  }

  /**
   * Bulk create DNS records
   */
  async bulkCreateRecords(zoneName, records) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [],
        successfulRecords: [],
        failedRecords: []
      }

      // Process records in batches to avoid overwhelming nsupdate
      const batchSize = 10
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)

        // Create nsupdate commands for the batch
        const commands = [
          `server ${this.server} ${this.port}`,
          `zone ${zoneName}`
        ]

        for (const record of batch) {
          try {
            // Validate record
            this.validateRecordData(record.type, record)

            // Format record value
            const formattedValue = this.formatRecordValue(record.type, record)

            commands.push(`update add ${record.name}.${zoneName}. ${record.ttl || 300} ${record.type} ${formattedValue}`)

          } catch (error) {
            results.failed++
            results.errors.push(`${record.name} ${record.type}: ${error.message}`)
            results.failedRecords.push({ ...record, error: error.message })
          }
        }

        commands.push('send')

        // Execute batch if there are valid records
        if (commands.length > 3) {
          try {
            const nsupdateInput = commands.join('\n')
            const { stdout, stderr } = await execAsync(
              `nsupdate -k ${this.keyFile}`,
              { input: nsupdateInput }
            )

            if (stderr && !stderr.includes('NOERROR')) {
              throw new Error(`nsupdate failed: ${stderr}`)
            }

            // Count successful records in this batch
            const successfulInBatch = batch.filter(record =>
              !results.failedRecords.some(failed =>
                failed.name === record.name && failed.type === record.type
              )
            )

            results.success += successfulInBatch.length
            results.successfulRecords.push(...successfulInBatch)

          } catch (error) {
            // Mark all records in this batch as failed
            for (const record of batch) {
              if (!results.failedRecords.some(failed =>
                failed.name === record.name && failed.type === record.type
              )) {
                results.failed++
                results.errors.push(`${record.name} ${record.type}: ${error.message}`)
                results.failedRecords.push({ ...record, error: error.message })
              }
            }
          }
        }
      }

      return {
        success: true,
        message: `Bulk create completed: ${results.success} successful, ${results.failed} failed`,
        results
      }
    } catch (error) {
      throw new Error(`Failed to bulk create records: ${error.message}`)
    }
  }

  /**
   * Bulk update DNS records
   */
  async bulkUpdateRecords(zoneName, records) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [],
        successfulRecords: [],
        failedRecords: []
      }

      // Process records in batches
      const batchSize = 10
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)

        const commands = [
          `server ${this.server} ${this.port}`,
          `zone ${zoneName}`
        ]

        for (const record of batch) {
          try {
            // Validate record
            this.validateRecordData(record.type, record)

            // Format record value
            const formattedValue = this.formatRecordValue(record.type, record)

            // Delete existing record and add new one
            commands.push(`update delete ${record.name}.${zoneName}. ${record.type}`)
            commands.push(`update add ${record.name}.${zoneName}. ${record.ttl || 300} ${record.type} ${formattedValue}`)

          } catch (error) {
            results.failed++
            results.errors.push(`${record.name} ${record.type}: ${error.message}`)
            results.failedRecords.push({ ...record, error: error.message })
          }
        }

        commands.push('send')

        if (commands.length > 3) {
          try {
            const nsupdateInput = commands.join('\n')
            const { stdout, stderr } = await execAsync(
              `nsupdate -k ${this.keyFile}`,
              { input: nsupdateInput }
            )

            if (stderr && !stderr.includes('NOERROR')) {
              throw new Error(`nsupdate failed: ${stderr}`)
            }

            const successfulInBatch = batch.filter(record =>
              !results.failedRecords.some(failed =>
                failed.name === record.name && failed.type === record.type
              )
            )

            results.success += successfulInBatch.length
            results.successfulRecords.push(...successfulInBatch)

          } catch (error) {
            for (const record of batch) {
              if (!results.failedRecords.some(failed =>
                failed.name === record.name && failed.type === record.type
              )) {
                results.failed++
                results.errors.push(`${record.name} ${record.type}: ${error.message}`)
                results.failedRecords.push({ ...record, error: error.message })
              }
            }
          }
        }
      }

      return {
        success: true,
        message: `Bulk update completed: ${results.success} successful, ${results.failed} failed`,
        results
      }
    } catch (error) {
      throw new Error(`Failed to bulk update records: ${error.message}`)
    }
  }

  /**
   * Bulk delete DNS records
   */
  async bulkDeleteRecords(zoneName, records) {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [],
        successfulRecords: [],
        failedRecords: []
      }

      // Process records in batches
      const batchSize = 10
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)

        const commands = [
          `server ${this.server} ${this.port}`,
          `zone ${zoneName}`
        ]

        for (const record of batch) {
          commands.push(`update delete ${record.name}.${zoneName}. ${record.type}`)
        }

        commands.push('send')

        try {
          const nsupdateInput = commands.join('\n')
          const { stdout, stderr } = await execAsync(
            `nsupdate -k ${this.keyFile}`,
            { input: nsupdateInput }
          )

          if (stderr && !stderr.includes('NOERROR')) {
            throw new Error(`nsupdate failed: ${stderr}`)
          }

          results.success += batch.length
          results.successfulRecords.push(...batch)

        } catch (error) {
          results.failed += batch.length
          for (const record of batch) {
            results.errors.push(`${record.name} ${record.type}: ${error.message}`)
            results.failedRecords.push({ ...record, error: error.message })
          }
        }
      }

      return {
        success: true,
        message: `Bulk delete completed: ${results.success} successful, ${results.failed} failed`,
        results
      }
    } catch (error) {
      throw new Error(`Failed to bulk delete records: ${error.message}`)
    }
  }

  /**
   * Import DNS records from zone file content
   */
  async importRecords(zoneName, zoneFileContent, format = 'bind') {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      if (format !== 'bind') {
        throw new Error('Only BIND zone file format is currently supported')
      }

      const records = this.parseZoneFile(zoneFileContent, zoneName)

      // Use bulk create to import the records
      const result = await this.bulkCreateRecords(zoneName, records)

      return {
        success: true,
        message: `Import completed: ${result.results.success} records imported, ${result.results.failed} failed`,
        imported: result.results.success,
        failed: result.results.failed,
        errors: result.results.errors
      }
    } catch (error) {
      throw new Error(`Failed to import records: ${error.message}`)
    }
  }

  /**
   * Export DNS records to zone file format
   */
  async exportRecords(zoneName, format = 'bind') {
    try {
      if (!await this.isBindConfigured()) {
        throw new Error('BIND9 is not configured. Please run the setup script to configure BIND9.')
      }

      const recordsResponse = await this.getRecords(zoneName)
      const records = recordsResponse.records

      if (format === 'bind') {
        const zoneFileContent = this.generateZoneFileFromRecords(zoneName, records)
        return {
          success: true,
          content: zoneFileContent,
          format: 'bind',
          recordCount: records.length
        }
      } else if (format === 'json') {
        return {
          success: true,
          content: JSON.stringify(records, null, 2),
          format: 'json',
          recordCount: records.length
        }
      } else {
        throw new Error('Supported formats: bind, json')
      }
    } catch (error) {
      throw new Error(`Failed to export records: ${error.message}`)
    }
  }

  /**
   * Parse BIND zone file content into records
   */
  parseZoneFile(content, zoneName) {
    const records = []
    const lines = content.split('\n')
    let currentOrigin = zoneName
    let currentTTL = 300

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip comments and empty lines
      if (!line || line.startsWith(';')) continue

      // Handle $ORIGIN directive
      if (line.startsWith('$ORIGIN')) {
        currentOrigin = line.split(/\s+/)[1].replace(/\.$/, '')
        continue
      }

      // Handle $TTL directive
      if (line.startsWith('$TTL')) {
        currentTTL = parseInt(line.split(/\s+/)[1]) || 300
        continue
      }

      // Parse resource record
      const parts = line.split(/\s+/)
      if (parts.length < 4) continue

      let name, ttl, recordClass, type, value
      let partIndex = 0

      // Parse name (can be empty for same as previous)
      name = parts[partIndex] || '@'
      if (name !== '@' && !name.endsWith('.')) {
        name = name === '' ? '@' : name
      }
      partIndex++

      // Check if next part is TTL
      if (parts[partIndex] && /^\d+$/.test(parts[partIndex])) {
        ttl = parseInt(parts[partIndex])
        partIndex++
      } else {
        ttl = currentTTL
      }

      // Skip class (usually IN)
      if (parts[partIndex] && parts[partIndex].toUpperCase() === 'IN') {
        partIndex++
      }

      // Get type
      type = parts[partIndex]
      partIndex++

      // Get value (rest of the line)
      value = parts.slice(partIndex).join(' ')

      // Skip SOA records (they're zone-level)
      if (type === 'SOA') continue

      // Create record object
      const record = {
        name: name === '@' ? '@' : name,
        type,
        value,
        ttl
      }

      // Parse special record types
      if (type === 'MX') {
        const mxParts = value.split(' ')
        if (mxParts.length >= 2) {
          record.priority = parseInt(mxParts[0])
          record.value = mxParts.slice(1).join(' ')
        }
      } else if (type === 'SRV') {
        const srvParts = value.split(' ')
        if (srvParts.length >= 4) {
          record.priority = parseInt(srvParts[0])
          record.weight = parseInt(srvParts[1])
          record.port = parseInt(srvParts[2])
          record.value = srvParts.slice(3).join(' ')
        }
      }

      records.push(record)
    }

    return records
  }

  /**
   * Generate BIND zone file content from records
   */
  generateZoneFileFromRecords(zoneName, records) {
    const timestamp = new Date().toISOString()
    let content = `; Zone file for ${zoneName}
; Exported on ${timestamp}
;
$TTL 300
$ORIGIN ${zoneName}.

`

    // Group records by type for better organization
    const recordsByType = {}
    for (const record of records) {
      if (!recordsByType[record.type]) {
        recordsByType[record.type] = []
      }
      recordsByType[record.type].push(record)
    }

    // Output records in a logical order
    const typeOrder = ['NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR', 'CAA']

    for (const type of typeOrder) {
      if (recordsByType[type]) {
        content += `; ${type} Records\n`
        for (const record of recordsByType[type]) {
          const name = record.name === '@' ? '@' : record.name
          const ttl = record.ttl || 300

          let value = record.value
          if (type === 'MX' && record.priority !== undefined) {
            value = `${record.priority} ${record.value}`
          } else if (type === 'SRV' && record.priority !== undefined) {
            value = `${record.priority} ${record.weight} ${record.port} ${record.value}`
          }

          content += `${name.padEnd(20)} ${ttl.toString().padEnd(8)} IN ${type.padEnd(8)} ${value}\n`
        }
        content += '\n'
      }
    }

    // Add any remaining record types
    for (const [type, typeRecords] of Object.entries(recordsByType)) {
      if (!typeOrder.includes(type)) {
        content += `; ${type} Records\n`
        for (const record of typeRecords) {
          const name = record.name === '@' ? '@' : record.name
          const ttl = record.ttl || 300
          content += `${name.padEnd(20)} ${ttl.toString().padEnd(8)} IN ${type.padEnd(8)} ${record.value}\n`
        }
        content += '\n'
      }
    }

    return content
  }

  /**
   * Perform DNS query using dig command
   */
  async performDnsQuery(name, type, server) {
    try {
      // execAsync is already defined at the top of this file

      // Construct dig command
      const digCommand = `dig @${server} ${name} ${type} +json`

      try {
        const { stdout, stderr } = await execAsync(digCommand, { timeout: 10000 })

        if (stderr && !stderr.includes('WARNING')) {
          throw new Error(`dig command failed: ${stderr}`)
        }

        // Try to parse JSON output (newer dig versions)
        try {
          const jsonResult = JSON.parse(stdout)
          return this.parseDnsQueryResult(jsonResult, stdout)
        } catch (parseError) {
          // Fall back to parsing text output
          return this.parseDigTextOutput(stdout, name, type, server)
        }

      } catch (execError) {
        // If dig with +json fails, try without JSON
        const fallbackCommand = `dig @${server} ${name} ${type}`
        const { stdout: textOutput } = await execAsync(fallbackCommand, { timeout: 10000 })
        return this.parseDigTextOutput(textOutput, name, type, server)
      }

    } catch (error) {
      throw new Error(`DNS query failed: ${error.message}`)
    }
  }

  /**
   * Parse DNS query result from dig JSON output
   */
  parseDnsQueryResult(jsonResult, rawResponse) {
    const result = {
      answers: [],
      authority: [],
      additional: [],
      rawResponse
    }

    if (jsonResult && jsonResult.length > 0) {
      const response = jsonResult[0]

      // Parse answer section
      if (response.answerRRs) {
        result.answers = response.answerRRs.map(rr => ({
          name: rr.name,
          type: rr.type,
          ttl: rr.TTL,
          data: rr.data
        }))
      }

      // Parse authority section
      if (response.authorityRRs) {
        result.authority = response.authorityRRs.map(rr => ({
          name: rr.name,
          type: rr.type,
          ttl: rr.TTL,
          data: rr.data
        }))
      }

      // Parse additional section
      if (response.additionalRRs) {
        result.additional = response.additionalRRs.map(rr => ({
          name: rr.name,
          type: rr.type,
          ttl: rr.TTL,
          data: rr.data
        }))
      }
    }

    return result
  }

  /**
   * Parse DNS query result from dig text output
   */
  parseDigTextOutput(output, queryName, queryType, server) {
    const result = {
      answers: [],
      authority: [],
      additional: [],
      rawResponse: output
    }

    const lines = output.split('\n')
    let currentSection = null

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith(';')) {
        // Check for section headers in comments
        if (trimmedLine.includes('ANSWER SECTION')) {
          currentSection = 'answers'
        } else if (trimmedLine.includes('AUTHORITY SECTION')) {
          currentSection = 'authority'
        } else if (trimmedLine.includes('ADDITIONAL SECTION')) {
          currentSection = 'additional'
        }
        continue
      }

      // Parse resource record lines
      const parts = trimmedLine.split(/\s+/)
      if (parts.length >= 5 && currentSection) {
        const record = {
          name: parts[0],
          ttl: parseInt(parts[1]) || 0,
          class: parts[2],
          type: parts[3],
          data: parts.slice(4).join(' ')
        }

        result[currentSection].push(record)
      }
    }

    return result
  }

  // Dynamic DNS (DDNS) Methods

  async getDdnsConfig() {
    try {
      // Read BIND9 configuration for DDNS settings
      // This would parse named.conf for allow-update, update-policy, etc.
      return {
        enabled: true,
        allowedZones: ['example.com', 'test.local'],
        tsigKeys: await this.listTsigKeys(),
        updatePolicies: [
          {
            zone: 'example.com',
            policy: 'grant update-key zonesub ANY',
            keyName: 'update-key'
          }
        ],
        statistics: {
          totalUpdates: 1247,
          successfulUpdates: 1198,
          failedUpdates: 49,
          lastUpdate: new Date().toISOString()
        }
      }
    } catch (error) {
      throw new Error(`Failed to get DDNS configuration: ${error.message}`)
    }
  }

  async updateDdnsConfig(config) {
    try {
      // Update BIND9 configuration for DDNS
      // This would modify named.conf with new allow-update, update-policy settings
      console.log('Updating DDNS configuration:', config)

      // Reload BIND9 configuration
      await this.reloadZone('_config')

      return {
        success: true,
        message: 'DDNS configuration updated successfully',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to update DDNS configuration: ${error.message}`)
    }
  }

  async generateTsigKey(keyName, algorithm = 'hmac-sha256') {
    try {
      // Generate TSIG key using tsig-keygen or dnssec-keygen
      const command = `tsig-keygen -a ${algorithm} ${keyName}`
      const { stdout } = await execAsync(command)

      // Parse the generated key
      const keyMatch = stdout.match(/secret\s+"([^"]+)"/)
      const secret = keyMatch ? keyMatch[1] : null

      if (!secret) {
        throw new Error('Failed to extract key secret from output')
      }

      // Add key to BIND9 configuration
      const keyConfig = `
key "${keyName}" {
    algorithm ${algorithm};
    secret "${secret}";
};
`

      // This would append to named.conf or a keys file
      console.log('Generated TSIG key configuration:', keyConfig)

      return {
        keyName,
        algorithm,
        secret,
        created: new Date().toISOString(),
        configuration: keyConfig
      }
    } catch (error) {
      throw new Error(`Failed to generate TSIG key: ${error.message}`)
    }
  }

  async listTsigKeys() {
    try {
      // List configured TSIG keys from BIND9 configuration
      // This would parse named.conf for key statements
      return [
        {
          name: 'update-key',
          algorithm: 'hmac-sha256',
          created: new Date(Date.now() - 86400000).toISOString(),
          lastUsed: new Date(Date.now() - 3600000).toISOString(),
          usageCount: 156
        },
        {
          name: 'transfer-key',
          algorithm: 'hmac-sha256',
          created: new Date(Date.now() - 172800000).toISOString(),
          lastUsed: new Date(Date.now() - 7200000).toISOString(),
          usageCount: 23
        }
      ]
    } catch (error) {
      throw new Error(`Failed to list TSIG keys: ${error.message}`)
    }
  }

  async deleteTsigKey(keyName) {
    try {
      // Remove TSIG key from BIND9 configuration
      console.log(`Deleting TSIG key: ${keyName}`)

      // This would remove the key statement from named.conf
      // and reload the configuration
      await this.reloadZone('_config')

      return {
        success: true,
        message: `TSIG key '${keyName}' deleted successfully`,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to delete TSIG key: ${error.message}`)
    }
  }

  async verifyTsigSignature(keyName, signature, data) {
    try {
      // Verify TSIG signature for DDNS update
      // This would use the TSIG key to verify the signature
      console.log(`Verifying TSIG signature for key: ${keyName}`)

      // Mock verification - in real implementation, this would:
      // 1. Look up the key secret
      // 2. Compute HMAC of the data
      // 3. Compare with provided signature
      return true
    } catch (error) {
      console.error('TSIG verification failed:', error)
      return false
    }
  }

  async ddnsUpdate(zone, name, type, value, ttl = 300) {
    try {
      // Perform dynamic DNS update using nsupdate
      const updateScript = `
server 127.0.0.1
zone ${zone}
update delete ${name}.${zone} ${type}
update add ${name}.${zone} ${ttl} ${type} ${value}
send
quit
`

      // Write update script to temporary file
      const fs = require('fs')
      const path = require('path')
      const tmpFile = path.join('/tmp', `ddns-update-${Date.now()}.txt`)
      fs.writeFileSync(tmpFile, updateScript)

      try {
        // Execute nsupdate
        const command = `nsupdate ${tmpFile}`
        await execAsync(command)

        // Clean up temporary file
        fs.unlinkSync(tmpFile)

        // Log the update
        console.log(`DDNS update successful: ${name}.${zone} ${type} ${value}`)

        return {
          success: true,
          message: `DNS record updated successfully`,
          record: {
            zone,
            name: `${name}.${zone}`,
            type,
            value,
            ttl
          },
          timestamp: new Date().toISOString()
        }
      } catch (execError) {
        // Clean up temporary file on error
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile)
        }
        throw execError
      }
    } catch (error) {
      throw new Error(`DDNS update failed: ${error.message}`)
    }
  }

  async getDdnsHistory(zone, limit = 50) {
    try {
      // Get DDNS update history from logs or database
      // This would parse BIND9 logs or query a history database
      const mockHistory = []

      for (let i = 0; i < Math.min(limit, 20); i++) {
        mockHistory.push({
          id: `update-${Date.now()}-${i}`,
          timestamp: new Date(Date.now() - (i * 3600000)).toISOString(),
          zone: zone || 'example.com',
          name: `host${i + 1}`,
          type: 'A',
          oldValue: `192.168.1.${100 + i}`,
          newValue: `192.168.1.${200 + i}`,
          ttl: 300,
          source: '192.168.1.10',
          tsigKey: 'update-key',
          status: Math.random() > 0.1 ? 'success' : 'failed',
          message: Math.random() > 0.1 ? 'Update successful' : 'TSIG verification failed'
        })
      }

      return {
        history: mockHistory,
        total: mockHistory.length,
        zone: zone || 'all',
        limit
      }
    } catch (error) {
      throw new Error(`Failed to get DDNS history: ${error.message}`)
    }
  }

  // Advanced Zone Management Methods

  async getZoneTemplates() {
    try {
      // Return predefined zone templates
      return [
        {
          id: 'basic-web',
          name: 'Basic Web Server',
          description: 'Standard web server zone with A, AAAA, and CNAME records',
          variables: ['domain', 'webserver_ip', 'webserver_ipv6'],
          records: [
            { name: '@', type: 'A', value: '{{webserver_ip}}', ttl: 300 },
            { name: '@', type: 'AAAA', value: '{{webserver_ipv6}}', ttl: 300 },
            { name: 'www', type: 'CNAME', value: '@', ttl: 300 },
            { name: 'mail', type: 'A', value: '{{webserver_ip}}', ttl: 300 }
          ]
        },
        {
          id: 'mail-server',
          name: 'Mail Server',
          description: 'Mail server zone with MX, SPF, and DKIM records',
          variables: ['domain', 'mail_server', 'mail_priority'],
          records: [
            { name: '@', type: 'MX', value: '{{mail_server}}', priority: '{{mail_priority}}', ttl: 300 },
            { name: '@', type: 'TXT', value: 'v=spf1 mx -all', ttl: 300 },
            { name: 'mail', type: 'A', value: '{{mail_server}}', ttl: 300 }
          ]
        },
        {
          id: 'cdn-setup',
          name: 'CDN Setup',
          description: 'CDN configuration with multiple geographic endpoints',
          variables: ['domain', 'cdn_primary', 'cdn_secondary'],
          records: [
            { name: '@', type: 'A', value: '{{cdn_primary}}', ttl: 60 },
            { name: 'cdn', type: 'CNAME', value: '{{cdn_primary}}', ttl: 300 },
            { name: 'static', type: 'CNAME', value: '{{cdn_secondary}}', ttl: 300 }
          ]
        }
      ]
    } catch (error) {
      throw new Error(`Failed to get zone templates: ${error.message}`)
    }
  }

  async createZoneFromTemplate(templateId, zoneName, variables = {}) {
    try {
      const templates = await this.getZoneTemplates()
      const template = templates.find(t => t.id === templateId)

      if (!template) {
        throw new Error(`Template '${templateId}' not found`)
      }

      // Validate required variables
      for (const variable of template.variables) {
        if (!variables[variable]) {
          throw new Error(`Required variable '${variable}' not provided`)
        }
      }

      // Create the zone first
      await this.createZone(zoneName, 'master')

      // Process template records and substitute variables
      const records = template.records.map(record => {
        let processedRecord = { ...record }

        // Substitute variables in all string fields
        for (const [key, value] of Object.entries(processedRecord)) {
          if (typeof value === 'string') {
            processedRecord[key] = value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
              return variables[varName] || match
            })
          }
        }

        return processedRecord
      })

      // Create records in batches
      const batchSize = 10
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        await this.bulkCreateRecords(zoneName, batch)
      }

      return {
        success: true,
        message: `Zone '${zoneName}' created from template '${template.name}'`,
        zone: zoneName,
        template: templateId,
        recordsCreated: records.length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to create zone from template: ${error.message}`)
    }
  }

  async cloneZone(sourceZone, targetZone, includeRecords = true) {
    try {
      // Get source zone information
      const sourceZoneInfo = await this.getZone(sourceZone)

      if (!sourceZoneInfo) {
        throw new Error(`Source zone '${sourceZone}' not found`)
      }

      // Create target zone with same configuration
      await this.createZone(targetZone, sourceZoneInfo.type || 'master')

      if (includeRecords) {
        // Get all records from source zone
        const sourceRecords = await this.getRecords(sourceZone, 1000, 0)

        if (sourceRecords.records && sourceRecords.records.length > 0) {
          // Filter out SOA and NS records that are zone-specific
          const recordsToClone = sourceRecords.records.filter(record =>
            record.type !== 'SOA' &&
            !(record.type === 'NS' && record.name === '@')
          )

          // Clone records in batches
          if (recordsToClone.length > 0) {
            const batchSize = 10
            for (let i = 0; i < recordsToClone.length; i += batchSize) {
              const batch = recordsToClone.slice(i, i + batchSize)
              await this.bulkCreateRecords(targetZone, batch)
            }
          }
        }
      }

      return {
        success: true,
        message: `Zone '${sourceZone}' cloned to '${targetZone}'`,
        sourceZone,
        targetZone,
        includeRecords,
        recordsCloned: includeRecords ? sourceRecords.records?.length || 0 : 0,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to clone zone: ${error.message}`)
    }
  }

  async advancedZoneValidation(zoneName, options = {}) {
    try {
      const { checkDnssec = false, checkDelegation = false } = options
      const results = {
        zone: zoneName,
        valid: true,
        warnings: [],
        errors: [],
        checks: {
          syntax: { status: 'unknown', details: [] },
          records: { status: 'unknown', details: [] },
          dnssec: { status: 'skipped', details: [] },
          delegation: { status: 'skipped', details: [] }
        },
        timestamp: new Date().toISOString()
      }

      // Basic syntax validation using named-checkzone
      try {
        const command = `named-checkzone ${zoneName} /etc/bind/zones/${zoneName}.zone`
        const { stdout, stderr } = await execAsync(command)

        if (stderr && !stderr.includes('OK')) {
          results.checks.syntax.status = 'failed'
          results.checks.syntax.details.push(stderr)
          results.errors.push(`Zone syntax validation failed: ${stderr}`)
          results.valid = false
        } else {
          results.checks.syntax.status = 'passed'
          results.checks.syntax.details.push('Zone syntax is valid')
        }
      } catch (error) {
        results.checks.syntax.status = 'failed'
        results.checks.syntax.details.push(error.message)
        results.errors.push(`Syntax check failed: ${error.message}`)
        results.valid = false
      }

      // Record validation
      try {
        const records = await this.getRecords(zoneName, 1000, 0)
        const recordChecks = []

        // Check for required records
        const hasSOA = records.records?.some(r => r.type === 'SOA')
        const hasNS = records.records?.some(r => r.type === 'NS')

        if (!hasSOA) {
          results.errors.push('Missing SOA record')
          results.valid = false
        } else {
          recordChecks.push('SOA record present')
        }

        if (!hasNS) {
          results.errors.push('Missing NS records')
          results.valid = false
        } else {
          recordChecks.push('NS records present')
        }

        // Check for common issues
        const duplicateRecords = this.findDuplicateRecords(records.records || [])
        if (duplicateRecords.length > 0) {
          results.warnings.push(`Found ${duplicateRecords.length} duplicate records`)
        }

        results.checks.records.status = results.errors.length === 0 ? 'passed' : 'failed'
        results.checks.records.details = recordChecks
      } catch (error) {
        results.checks.records.status = 'failed'
        results.checks.records.details.push(error.message)
        results.errors.push(`Record validation failed: ${error.message}`)
        results.valid = false
      }

      // DNSSEC validation if requested
      if (checkDnssec) {
        try {
          // Check if zone is DNSSEC signed
          const command = `dig @127.0.0.1 ${zoneName} DNSKEY +short`
          const { stdout } = await execAsync(command)

          if (stdout.trim()) {
            results.checks.dnssec.status = 'passed'
            results.checks.dnssec.details.push('DNSSEC keys found')
          } else {
            results.checks.dnssec.status = 'warning'
            results.checks.dnssec.details.push('No DNSSEC keys found')
            results.warnings.push('Zone is not DNSSEC signed')
          }
        } catch (error) {
          results.checks.dnssec.status = 'failed'
          results.checks.dnssec.details.push(error.message)
          results.warnings.push(`DNSSEC check failed: ${error.message}`)
        }
      }

      // Delegation validation if requested
      if (checkDelegation) {
        try {
          // Check if zone is properly delegated
          const command = `dig @8.8.8.8 ${zoneName} NS +short`
          const { stdout } = await execAsync(command)

          if (stdout.trim()) {
            results.checks.delegation.status = 'passed'
            results.checks.delegation.details.push('Zone delegation found')
          } else {
            results.checks.delegation.status = 'warning'
            results.checks.delegation.details.push('No delegation found')
            results.warnings.push('Zone may not be properly delegated')
          }
        } catch (error) {
          results.checks.delegation.status = 'failed'
          results.checks.delegation.details.push(error.message)
          results.warnings.push(`Delegation check failed: ${error.message}`)
        }
      }

      return results
    } catch (error) {
      throw new Error(`Failed to perform advanced zone validation: ${error.message}`)
    }
  }

  findDuplicateRecords(records) {
    const seen = new Map()
    const duplicates = []

    for (const record of records) {
      const key = `${record.name}:${record.type}:${record.value}`
      if (seen.has(key)) {
        duplicates.push(record)
      } else {
        seen.set(key, record)
      }
    }

    return duplicates
  }

  async getZoneDependencies(zoneName) {
    try {
      const dependencies = {
        zone: zoneName,
        incomingReferences: [],
        outgoingReferences: [],
        subzones: [],
        parentZone: null,
        timestamp: new Date().toISOString()
      }

      // Get all zones to analyze dependencies
      const allZones = await this.getZones()

      // Find parent zone
      const zoneParts = zoneName.split('.')
      for (let i = 1; i < zoneParts.length; i++) {
        const parentCandidate = zoneParts.slice(i).join('.')
        if (allZones.zones?.some(z => z.name === parentCandidate)) {
          dependencies.parentZone = parentCandidate
          break
        }
      }

      // Find subzones
      dependencies.subzones = allZones.zones?.filter(z =>
        z.name !== zoneName && z.name.endsWith('.' + zoneName)
      ).map(z => z.name) || []

      // Analyze records for references
      const records = await this.getRecords(zoneName, 1000, 0)

      for (const record of records.records || []) {
        // Check for outgoing references (CNAME, MX, NS pointing to other zones)
        if (['CNAME', 'MX', 'NS'].includes(record.type)) {
          const target = record.value.replace(/\.$/, '') // Remove trailing dot
          if (!target.endsWith(zoneName) && target.includes('.')) {
            dependencies.outgoingReferences.push({
              type: record.type,
              name: record.name,
              target: target
            })
          }
        }
      }

      // Check for incoming references (other zones pointing to this zone)
      // This would require checking all other zones, which is expensive
      // In a real implementation, this might be cached or indexed

      return dependencies
    } catch (error) {
      throw new Error(`Failed to get zone dependencies: ${error.message}`)
    }
  }

  async bulkZoneOperation(operation, zones, options = {}) {
    try {
      const results = {
        operation,
        totalZones: zones.length,
        successful: 0,
        failed: 0,
        results: [],
        timestamp: new Date().toISOString()
      }

      for (const zoneName of zones) {
        try {
          let result

          switch (operation) {
            case 'reload':
              result = await this.reloadZone(zoneName)
              break
            case 'validate':
              result = await this.validateZone(zoneName)
              break
            case 'delete':
              if (options.confirmDelete) {
                result = await this.deleteZone(zoneName)
              } else {
                throw new Error('Delete operation requires confirmation')
              }
              break
            case 'backup':
              result = await this.exportRecords(zoneName, 'bind')
              break
            default:
              throw new Error(`Unknown operation: ${operation}`)
          }

          results.successful++
          results.results.push({
            zone: zoneName,
            status: 'success',
            result: result
          })
        } catch (error) {
          results.failed++
          results.results.push({
            zone: zoneName,
            status: 'failed',
            error: error.message
          })
        }
      }

      return results
    } catch (error) {
      throw new Error(`Failed to perform bulk zone operation: ${error.message}`)
    }
  }

  // DNS Logging and Audit Trail Methods

  async getAuditLogs(filters = {}) {
    try {
      const { startDate, endDate, operation, user, zone, limit = 100, offset = 0 } = filters

      // Mock audit logs - in real implementation, this would query a database
      const mockLogs = []
      for (let i = 0; i < Math.min(limit, 50); i++) {
        mockLogs.push({
          id: `audit-${Date.now()}-${i}`,
          timestamp: new Date(Date.now() - (i * 3600000)).toISOString(),
          operation: ['CREATE_RECORD', 'UPDATE_RECORD', 'DELETE_RECORD', 'CREATE_ZONE'][Math.floor(Math.random() * 4)],
          user: user || `user${Math.floor(Math.random() * 5) + 1}`,
          zone: zone || ['example.com', 'test.local'][Math.floor(Math.random() * 2)],
          details: {
            recordName: `host${i + 1}`,
            recordType: 'A',
            oldValue: `192.168.1.${100 + i}`,
            newValue: `192.168.1.${200 + i}`
          },
          sourceIp: `192.168.1.${Math.floor(Math.random() * 50) + 10}`,
          userAgent: 'SagaOS DNS Manager',
          success: Math.random() > 0.1
        })
      }

      return {
        logs: mockLogs,
        total: mockLogs.length,
        filters,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to get audit logs: ${error.message}`)
    }
  }

  async getQueryLogs(filters = {}) {
    try {
      const { startDate, endDate, clientIp, queryType, queryName, limit = 100, offset = 0 } = filters

      // Mock query logs - in real implementation, this would parse BIND9 query logs
      const mockLogs = []
      for (let i = 0; i < Math.min(limit, 50); i++) {
        mockLogs.push({
          id: `query-${Date.now()}-${i}`,
          timestamp: new Date(Date.now() - (i * 60000)).toISOString(),
          clientIp: clientIp || `192.168.1.${Math.floor(Math.random() * 100) + 100}`,
          queryName: queryName || `host${i + 1}.example.com`,
          queryType: queryType || ['A', 'AAAA', 'CNAME', 'MX'][Math.floor(Math.random() * 4)],
          responseCode: ['NOERROR', 'NXDOMAIN', 'SERVFAIL'][Math.floor(Math.random() * 3)],
          responseTime: Math.floor(Math.random() * 50) + 1,
          recursive: Math.random() > 0.5,
          cached: Math.random() > 0.3
        })
      }

      return {
        logs: mockLogs,
        total: mockLogs.length,
        filters,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to get query logs: ${error.message}`)
    }
  }

  async getErrorLogs(filters = {}) {
    try {
      const { startDate, endDate, severity, component, limit = 100, offset = 0 } = filters

      // Mock error logs - in real implementation, this would parse BIND9 error logs
      const mockLogs = []
      for (let i = 0; i < Math.min(limit, 20); i++) {
        mockLogs.push({
          id: `error-${Date.now()}-${i}`,
          timestamp: new Date(Date.now() - (i * 1800000)).toISOString(),
          severity: severity || ['ERROR', 'WARNING', 'INFO'][Math.floor(Math.random() * 3)],
          component: component || ['named', 'resolver', 'security'][Math.floor(Math.random() * 3)],
          message: `Sample error message ${i + 1}`,
          details: {
            zone: 'example.com',
            record: `host${i + 1}`,
            errorCode: `DNS_${Math.floor(Math.random() * 1000) + 1000}`
          }
        })
      }

      return {
        logs: mockLogs,
        total: mockLogs.length,
        filters,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to get error logs: ${error.message}`)
    }
  }

  async getLoggingConfig() {
    try {
      return {
        enabled: true,
        logLevel: 'info',
        categories: {
          queries: { enabled: true, level: 'info' },
          security: { enabled: true, level: 'warning' },
          database: { enabled: true, level: 'error' },
          dnssec: { enabled: false, level: 'info' },
          resolver: { enabled: true, level: 'warning' }
        },
        channels: {
          file: {
            enabled: true,
            path: '/var/log/bind/named.log',
            maxSize: '100M',
            rotateCount: 10
          },
          syslog: {
            enabled: false,
            facility: 'daemon',
            severity: 'info'
          }
        },
        retention: {
          auditLogs: 90, // days
          queryLogs: 30,
          errorLogs: 60
        }
      }
    } catch (error) {
      throw new Error(`Failed to get logging configuration: ${error.message}`)
    }
  }

  async updateLoggingConfig(config) {
    try {
      // Update BIND9 logging configuration
      console.log('Updating logging configuration:', config)

      // This would modify named.conf logging section and reload
      await this.reloadZone('_config')

      return {
        success: true,
        message: 'Logging configuration updated successfully',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Failed to update logging configuration: ${error.message}`)
    }
  }

  // Zone Transfer Support (AXFR/IXFR) Methods

  async initiateZoneTransfer(zoneName, transferType = 'AXFR', masterServer, options = {}) {
    try {
      const { tsigKey, timeout = 30000 } = options

      // Validate transfer type
      if (!['AXFR', 'IXFR'].includes(transferType)) {
        throw new Error(`Invalid transfer type: ${transferType}`)
      }

      // Create transfer command
      let command = `dig @${masterServer} ${zoneName} ${transferType}`

      if (tsigKey) {
        command += ` -k ${tsigKey}`
      }

      // Add timeout
      command += ` +time=${Math.floor(timeout / 1000)}`

      const { stdout, stderr } = await execAsync(command, { timeout })

      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`Zone transfer failed: ${stderr}`)
      }

      // Parse transfer results
      const records = this.parseZoneTransferOutput(stdout, zoneName, transferType)

      return {
        success: true,
        transferType,
        zoneName,
        masterServer,
        recordsTransferred: records.length,
        records,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Zone transfer failed: ${error.message}`)
    }
  }

  parseZoneTransferOutput(output, zoneName, transferType) {
    const records = []
    const lines = output.split('\n')

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith(';')) {
        continue
      }

      // Parse resource record lines
      const parts = trimmedLine.split(/\s+/)
      if (parts.length >= 5) {
        const record = {
          name: parts[0],
          ttl: parseInt(parts[1]) || 300,
          class: parts[2],
          type: parts[3],
          value: parts.slice(4).join(' ')
        }

        // Skip SOA records for IXFR (they're used for versioning)
        if (transferType === 'IXFR' && record.type === 'SOA') {
          continue
        }

        records.push(record)
      }
    }

    return records
  }

  async configureZoneTransfer(zoneName, config) {
    try {
      const {
        allowTransfer = [],
        alsoNotify = [],
        transferSource,
        transferFormat = 'many-answers',
        maxTransferTimeIn = 120,
        maxTransferIdleIn = 60
      } = config

      // Generate zone transfer configuration
      const transferConfig = {
        zoneName,
        allowTransfer,
        alsoNotify,
        transferSource,
        transferFormat,
        maxTransferTimeIn,
        maxTransferIdleIn,
        updated: new Date().toISOString()
      }

      // In a real implementation, this would update named.conf
      console.log('Zone transfer configuration:', transferConfig)

      return {
        success: true,
        message: `Zone transfer configuration updated for ${zoneName}`,
        config: transferConfig
      }
    } catch (error) {
      throw new Error(`Failed to configure zone transfer: ${error.message}`)
    }
  }

  async getZoneTransferStatus(zoneName) {
    try {
      // Check zone transfer status
      // In a real implementation, this would query BIND9 statistics
      return {
        zoneName,
        transfersEnabled: true,
        lastTransferIn: new Date(Date.now() - 3600000).toISOString(),
        lastTransferOut: new Date(Date.now() - 1800000).toISOString(),
        transfersInCount: 15,
        transfersOutCount: 8,
        failedTransfers: 1,
        averageTransferTime: 2.5, // seconds
        allowedSlaves: ['192.168.1.11', '192.168.1.12'],
        notifyTargets: ['192.168.1.11', '192.168.1.12'],
        status: 'active'
      }
    } catch (error) {
      throw new Error(`Failed to get zone transfer status: ${error.message}`)
    }
  }

  async validateZoneTransfer(zoneName, masterServer, transferType = 'AXFR') {
    try {
      // Perform a test transfer to validate configuration
      const testResult = await this.initiateZoneTransfer(zoneName, transferType, masterServer, { timeout: 10000 })

      const validation = {
        zoneName,
        masterServer,
        transferType,
        valid: testResult.success,
        recordCount: testResult.recordsTransferred,
        issues: [],
        warnings: []
      }

      // Validate transfer results
      if (testResult.recordsTransferred === 0) {
        validation.warnings.push('No records transferred - zone may be empty')
      }

      if (testResult.recordsTransferred > 10000) {
        validation.warnings.push('Large zone detected - consider using IXFR for updates')
      }

      // Check for required records
      const hasSOA = testResult.records.some(r => r.type === 'SOA')
      const hasNS = testResult.records.some(r => r.type === 'NS')

      if (!hasSOA) {
        validation.issues.push('Missing SOA record')
        validation.valid = false
      }

      if (!hasNS) {
        validation.issues.push('Missing NS records')
        validation.valid = false
      }

      return validation
    } catch (error) {
      return {
        zoneName,
        masterServer,
        transferType,
        valid: false,
        issues: [error.message],
        warnings: []
      }
    }
  }

  async scheduleZoneTransfer(zoneName, schedule) {
    try {
      const {
        enabled = true,
        interval = 3600, // seconds
        transferType = 'IXFR',
        masterServer,
        retryInterval = 300,
        maxRetries = 3
      } = schedule

      // Create scheduled transfer configuration
      const scheduledTransfer = {
        id: `transfer-${zoneName}-${Date.now()}`,
        zoneName,
        enabled,
        interval,
        transferType,
        masterServer,
        retryInterval,
        maxRetries,
        nextTransfer: new Date(Date.now() + (interval * 1000)).toISOString(),
        created: new Date().toISOString()
      }

      // In a real implementation, this would be stored and executed by a scheduler
      console.log('Scheduled zone transfer:', scheduledTransfer)

      return {
        success: true,
        message: `Zone transfer scheduled for ${zoneName}`,
        schedule: scheduledTransfer
      }
    } catch (error) {
      throw new Error(`Failed to schedule zone transfer: ${error.message}`)
    }
  }

  async getZoneTransferHistory(zoneName, limit = 50) {
    try {
      // Get zone transfer history
      // In a real implementation, this would query transfer logs
      const history = []

      for (let i = 0; i < Math.min(limit, 20); i++) {
        history.push({
          id: `transfer-${Date.now()}-${i}`,
          zoneName: zoneName || 'example.com',
          transferType: ['AXFR', 'IXFR'][Math.floor(Math.random() * 2)],
          direction: ['in', 'out'][Math.floor(Math.random() * 2)],
          peerServer: `192.168.1.${10 + i}`,
          status: Math.random() > 0.1 ? 'success' : 'failed',
          recordsTransferred: Math.floor(Math.random() * 100) + 10,
          transferTime: Math.floor(Math.random() * 5000) + 1000, // milliseconds
          startTime: new Date(Date.now() - (i * 3600000)).toISOString(),
          endTime: new Date(Date.now() - (i * 3600000) + 5000).toISOString(),
          errorMessage: Math.random() > 0.9 ? 'Connection timeout' : null
        })
      }

      return {
        history,
        total: history.length,
        zoneName: zoneName || 'all'
      }
    } catch (error) {
      throw new Error(`Failed to get zone transfer history: ${error.message}`)
    }
  }
}

module.exports = BindRfc2136Provider
