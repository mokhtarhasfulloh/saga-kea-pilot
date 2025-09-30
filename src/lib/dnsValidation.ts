/**
 * Comprehensive DNS record validation utilities
 * Provides client-side validation with detailed error messages
 */

import { DnsRecordTypeT } from './schemas/dns'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export class DnsValidator {
  /**
   * Validate a complete DNS record
   */
  static validateRecord(record: {
    name: string
    type: DnsRecordTypeT
    value: string
    ttl: number
    priority?: number
    weight?: number
    port?: number
  }): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    // Validate name
    const nameValidation = this.validateRecordName(record.name, record.type)
    result.errors.push(...nameValidation.errors)
    result.warnings.push(...nameValidation.warnings)

    // Validate TTL
    const ttlValidation = this.validateTTL(record.ttl)
    result.errors.push(...ttlValidation.errors)
    result.warnings.push(...ttlValidation.warnings)

    // Validate value based on type
    const valueValidation = this.validateRecordValue(record.type, record.value, {
      priority: record.priority,
      weight: record.weight,
      port: record.port
    })
    result.errors.push(...valueValidation.errors)
    result.warnings.push(...valueValidation.warnings)

    result.isValid = result.errors.length === 0

    return result
  }

  /**
   * Validate record name
   */
  static validateRecordName(name: string, type: DnsRecordTypeT): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    if (!name || name.trim().length === 0) {
      result.errors.push('Record name cannot be empty')
      result.isValid = false
      return result
    }

    const cleanName = name.trim()

    // Check for invalid characters
    if (!/^[a-zA-Z0-9@._-]+$/.test(cleanName)) {
      result.errors.push('Record name contains invalid characters. Use only letters, numbers, @, ., _, and -')
      result.isValid = false
    }

    // Check length
    if (cleanName.length > 63) {
      result.errors.push('Record name too long (max 63 characters)')
      result.isValid = false
    }

    // Type-specific validations
    if (type === 'CNAME' && cleanName === '@') {
      result.errors.push('CNAME records cannot be created for the zone apex (@)')
      result.isValid = false
    }

    if (type === 'SRV' && !cleanName.startsWith('_')) {
      result.warnings.push('SRV record names typically start with underscore (e.g., _sip._tcp)')
    }

    // Check for common mistakes
    if (cleanName.includes('..')) {
      result.errors.push('Record name cannot contain consecutive dots')
      result.isValid = false
    }

    if (cleanName.startsWith('-') || cleanName.endsWith('-')) {
      result.errors.push('Record name cannot start or end with hyphen')
      result.isValid = false
    }

    return result
  }

  /**
   * Validate TTL value
   */
  static validateTTL(ttl: number): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 2147483647) {
      result.errors.push('TTL must be an integer between 1 and 2,147,483,647')
      result.isValid = false
      return result
    }

    // Provide warnings for common TTL ranges
    if (ttl < 60) {
      result.warnings.push('Very low TTL (< 60s) may cause high DNS query load')
    } else if (ttl > 86400) {
      result.warnings.push('High TTL (> 24h) may delay propagation of changes')
    }

    return result
  }

  /**
   * Validate record value based on type
   */
  static validateRecordValue(
    type: DnsRecordTypeT,
    value: string,
    options: { priority?: number; weight?: number; port?: number } = {}
  ): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    if (!value || value.trim().length === 0) {
      result.errors.push('Record value cannot be empty')
      result.isValid = false
      return result
    }

    const cleanValue = value.trim()

    switch (type) {
      case 'A':
        return this.validateIPv4(cleanValue)
      case 'AAAA':
        return this.validateIPv6(cleanValue)
      case 'CNAME':
        return this.validateDomainName(cleanValue, 'CNAME target')
      case 'MX':
        return this.validateMXRecord(cleanValue, options.priority)
      case 'SRV':
        return this.validateSRVRecord(cleanValue, options.priority, options.weight, options.port)
      case 'TXT':
        return this.validateTXTRecord(cleanValue)
      case 'NS':
        return this.validateDomainName(cleanValue, 'NS target')
      case 'PTR':
        return this.validateDomainName(cleanValue, 'PTR target')
      case 'CAA':
        return this.validateCAARecord(cleanValue)
      case 'SOA':
        return this.validateSOARecord(cleanValue)
      default:
        result.errors.push(`Unsupported record type: ${type}`)
        result.isValid = false
    }

    return result
  }

  /**
   * Validate IPv4 address
   */
  static validateIPv4(ip: string): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = ip.match(ipv4Regex)

    if (!match) {
      result.errors.push('Invalid IPv4 address format')
      result.isValid = false
      return result
    }

    const octets = match.slice(1).map(Number)
    
    for (let i = 0; i < octets.length; i++) {
      if (octets[i] > 255) {
        result.errors.push(`Invalid octet ${octets[i]} at position ${i + 1} (must be 0-255)`)
        result.isValid = false
      }
    }

    // Check for reserved ranges
    const firstOctet = octets[0]
    if (firstOctet === 0) {
      result.errors.push('IPv4 address cannot start with 0 (reserved)')
      result.isValid = false
    } else if (firstOctet === 127) {
      result.warnings.push('IPv4 address in loopback range (127.x.x.x)')
    } else if (firstOctet >= 224) {
      result.warnings.push('IPv4 address in multicast/reserved range (224+)')
    } else if (firstOctet === 10 || (firstOctet === 172 && octets[1] >= 16 && octets[1] <= 31) || (firstOctet === 192 && octets[1] === 168)) {
      result.warnings.push('IPv4 address in private range (RFC 1918)')
    }

    return result
  }

  /**
   * Validate IPv6 address
   */
  static validateIPv6(ip: string): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    // Basic IPv6 validation
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/

    if (!ipv6Regex.test(ip)) {
      result.errors.push('Invalid IPv6 address format')
      result.isValid = false
      return result
    }

    // Check for common IPv6 ranges
    if (ip.startsWith('::1')) {
      result.warnings.push('IPv6 loopback address')
    } else if (ip.startsWith('fe80:')) {
      result.warnings.push('IPv6 link-local address')
    } else if (ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      result.warnings.push('IPv6 unique local address (private)')
    }

    return result
  }

  /**
   * Validate domain name
   */
  static validateDomainName(domain: string, context = 'Domain name'): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    if (domain.length > 253) {
      result.errors.push(`${context} too long (max 253 characters)`)
      result.isValid = false
    }

    // Remove trailing dot for validation
    const cleanDomain = domain.replace(/\.$/, '')

    // Check for valid characters and structure
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/
    if (!domainRegex.test(cleanDomain)) {
      result.errors.push(`${context} contains invalid characters or format`)
      result.isValid = false
    }

    // Check label length
    const labels = cleanDomain.split('.')
    for (const label of labels) {
      if (label.length > 63) {
        result.errors.push(`${context} label "${label}" too long (max 63 characters)`)
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Validate MX record
   */
  static validateMXRecord(value: string, priority?: number): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    if (priority === undefined || priority < 0 || priority > 65535) {
      result.errors.push('MX record requires priority (0-65535)')
      result.isValid = false
    }

    const domainValidation = this.validateDomainName(value, 'MX target')
    result.errors.push(...domainValidation.errors)
    result.warnings.push(...domainValidation.warnings)

    if (domainValidation.errors.length > 0) {
      result.isValid = false
    }

    return result
  }

  /**
   * Validate SRV record
   */
  static validateSRVRecord(value: string, priority?: number, weight?: number, port?: number): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    if (priority === undefined || priority < 0 || priority > 65535) {
      result.errors.push('SRV record requires priority (0-65535)')
      result.isValid = false
    }

    if (weight === undefined || weight < 0 || weight > 65535) {
      result.errors.push('SRV record requires weight (0-65535)')
      result.isValid = false
    }

    if (port === undefined || port < 1 || port > 65535) {
      result.errors.push('SRV record requires port (1-65535)')
      result.isValid = false
    }

    const domainValidation = this.validateDomainName(value, 'SRV target')
    result.errors.push(...domainValidation.errors)
    result.warnings.push(...domainValidation.warnings)

    if (domainValidation.errors.length > 0) {
      result.isValid = false
    }

    return result
  }

  /**
   * Validate TXT record
   */
  static validateTXTRecord(value: string): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    if (value.length > 255) {
      result.errors.push('TXT record value too long (max 255 characters)')
      result.isValid = false
    }

    // Check for common TXT record formats and provide helpful warnings
    if (value.startsWith('v=spf1')) {
      if (!value.match(/\s+(~all|[+-]all)$/)) {
        result.warnings.push('SPF record should end with ~all, +all, or -all')
      }
    }

    if (value.startsWith('v=DKIM1')) {
      if (!value.includes('k=') || !value.includes('p=')) {
        result.warnings.push('DKIM record should contain k= and p= parameters')
      }
    }

    if (value.startsWith('v=DMARC1')) {
      if (!value.includes('p=')) {
        result.warnings.push('DMARC record should contain p= policy')
      }
    }

    return result
  }

  /**
   * Validate CAA record
   */
  static validateCAARecord(value: string): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    const caaRegex = /^(\d+)\s+(issue|issuewild|iodef)\s+"([^"]*)"$/
    const match = value.match(caaRegex)

    if (!match) {
      result.errors.push('CAA record format: flags tag "value" (e.g., 0 issue "letsencrypt.org")')
      result.isValid = false
      return result
    }

    const [, flags, tag, tagValue] = match
    const flagsNum = parseInt(flags, 10)

    if (flagsNum < 0 || flagsNum > 255) {
      result.errors.push('CAA flags must be 0-255')
      result.isValid = false
    }

    if (tag === 'iodef' && !tagValue.includes('@') && !tagValue.startsWith('http')) {
      result.warnings.push('CAA iodef value should be an email address or URL')
    }

    return result
  }

  /**
   * Validate SOA record
   */
  static validateSOARecord(value: string): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] }

    const soaParts = value.split(/\s+/)
    if (soaParts.length !== 7) {
      result.errors.push('SOA record format: mname rname serial refresh retry expire minimum')
      result.isValid = false
      return result
    }

    const [mname, rname, serial, refresh, retry, expire, minimum] = soaParts

    // Validate domain names
    const mnameValidation = this.validateDomainName(mname, 'SOA master name')
    result.errors.push(...mnameValidation.errors)

    const rnameValidation = this.validateDomainName(rname.replace('@', '.'), 'SOA responsible name')
    result.errors.push(...rnameValidation.errors)

    // Validate numeric fields
    const numericFields = { serial, refresh, retry, expire, minimum }
    for (const [field, value] of Object.entries(numericFields)) {
      const num = parseInt(value, 10)
      if (isNaN(num) || num < 0 || num > 4294967295) {
        result.errors.push(`SOA ${field} must be a valid 32-bit unsigned integer`)
        result.isValid = false
      }
    }

    if (result.errors.length > 0) {
      result.isValid = false
    }

    return result
  }
}
