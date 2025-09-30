// Validation utilities for Kea Pilot DHCP management
import { z } from 'zod'
import { 
  OptionData, 
  OptionDef, 
  Subnet, 
  ClientClass, 
  Reservation,
  validateOptionCodes,
  validateSubnetPools,
  type OptionDataT,
  type SubnetT,
  type ClientClassT
} from './schemas/dhcp'

export interface ValidationResult {
  success: boolean
  errors: string[]
  warnings: string[]
}

// Validate DHCP option data
export function validateOptionData(data: unknown): ValidationResult {
  const result: ValidationResult = { success: true, errors: [], warnings: [] }
  
  try {
    const parsed = OptionData.parse(data)
    
    // Additional business logic validation
    if (parsed.code === 43 && !parsed.data.match(/^[0-9A-Fa-f]+$/)) {
      result.warnings.push('Option 43 (vendor-encapsulated-options) should be in hex format')
    }
    
    if (parsed.code === 125 && !parsed.data.match(/^[0-9A-Fa-f]+$/)) {
      result.warnings.push('Option 125 (vendor-identifying-vendor-specific) should be in hex format')
    }
    
    // Check for potentially problematic configurations
    if (parsed['always-send'] && parsed['never-send']) {
      result.errors.push('Cannot set both always-send and never-send')
      result.success = false
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
    } else {
      result.errors = [String(error)]
    }
    result.success = false
  }
  
  return result
}

// Validate option definitions
export function validateOptionDef(data: unknown): ValidationResult {
  const result: ValidationResult = { success: true, errors: [], warnings: [] }
  
  try {
    OptionDef.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
    } else {
      result.errors = [String(error)]
    }
    result.success = false
  }
  
  return result
}

// Validate subnet configuration
export function validateSubnet(data: unknown): ValidationResult {
  const result: ValidationResult = { success: true, errors: [], warnings: [] }
  
  try {
    const parsed = Subnet.parse(data)
    
    // Additional subnet validation
    const poolErrors = validateSubnetPools(parsed)
    result.errors.push(...poolErrors)
    
    // Check for overlapping pools
    if (parsed.pools && parsed.pools.length > 1) {
      for (let i = 0; i < parsed.pools.length; i++) {
        for (let j = i + 1; j < parsed.pools.length; j++) {
          if (poolsOverlap(parsed.pools[i].pool, parsed.pools[j].pool)) {
            result.errors.push(`Pools overlap: ${parsed.pools[i].pool} and ${parsed.pools[j].pool}`)
            result.success = false
          }
        }
      }
    }
    
    // Validate option data within subnet
    if (parsed['option-data']) {
      const optionErrors = validateOptionCodes(parsed['option-data'])
      result.errors.push(...optionErrors)
      if (optionErrors.length > 0) result.success = false
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
    } else {
      result.errors = [String(error)]
    }
    result.success = false
  }
  
  return result
}

// Validate client class
export function validateClientClass(data: unknown): ValidationResult {
  const result: ValidationResult = { success: true, errors: [], warnings: [] }
  
  try {
    const parsed = ClientClass.parse(data)
    
    // Validate test expression syntax (basic check)
    if (!isValidTestExpression(parsed.test)) {
      result.warnings.push('Test expression may have syntax issues')
    }
    
    // Validate option data within class
    if (parsed['option-data']) {
      const optionErrors = validateOptionCodes(parsed['option-data'])
      result.errors.push(...optionErrors)
      if (optionErrors.length > 0) result.success = false
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
    } else {
      result.errors = [String(error)]
    }
    result.success = false
  }
  
  return result
}

// Validate reservation
export function validateReservation(data: unknown): ValidationResult {
  const result: ValidationResult = { success: true, errors: [], warnings: [] }
  
  try {
    const parsed = Reservation.parse(data)
    
    // Validate option data within reservation
    if (parsed['option-data']) {
      const optionErrors = validateOptionCodes(parsed['option-data'])
      result.errors.push(...optionErrors)
      if (optionErrors.length > 0) result.success = false
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
    } else {
      result.errors = [String(error)]
    }
    result.success = false
  }
  
  return result
}

// Validate complete DHCP configuration for conflicts
export function validateDhcpConfig(config: {
  'option-data'?: OptionDataT[]
  'client-classes'?: ClientClassT[]
  subnet4?: SubnetT[]
}): ValidationResult {
  const result: ValidationResult = { success: true, errors: [], warnings: [] }
  
  // Check for duplicate option codes across all scopes
  const allOptions: OptionDataT[] = []
  
  if (config['option-data']) {
    allOptions.push(...config['option-data'])
  }
  
  config.subnet4?.forEach(subnet => {
    if (subnet['option-data']) {
      allOptions.push(...subnet['option-data'])
    }
  })
  
  config['client-classes']?.forEach(cls => {
    if (cls['option-data']) {
      allOptions.push(...cls['option-data'])
    }
  })
  
  // Check for conflicts in option codes (warnings, not errors, as different scopes can have same codes)
  const globalCodes = new Set<number>()
  config['option-data']?.forEach(opt => {
    if (opt.code) globalCodes.add(opt.code)
  })
  
  config.subnet4?.forEach(subnet => {
    subnet['option-data']?.forEach(opt => {
      if (opt.code && globalCodes.has(opt.code)) {
        result.warnings.push(`Option code ${opt.code} defined in both global and subnet ${subnet.subnet}`)
      }
    })
  })
  
  // Check for duplicate client class names
  if (config['client-classes']) {
    const classNames = new Set<string>()
    config['client-classes'].forEach(cls => {
      if (classNames.has(cls.name)) {
        result.errors.push(`Duplicate client class name: ${cls.name}`)
        result.success = false
      }
      classNames.add(cls.name)
    })
  }
  
  // Check for subnet overlaps
  if (config.subnet4 && config.subnet4.length > 1) {
    for (let i = 0; i < config.subnet4.length; i++) {
      for (let j = i + 1; j < config.subnet4.length; j++) {
        if (subnetsOverlap(config.subnet4[i].subnet, config.subnet4[j].subnet)) {
          result.errors.push(`Subnets overlap: ${config.subnet4[i].subnet} and ${config.subnet4[j].subnet}`)
          result.success = false
        }
      }
    }
  }
  
  return result
}

// Helper functions
function isValidTestExpression(expr: string): boolean {
  // Basic validation for Kea test expressions
  // This is a simplified check - full validation would require parsing the expression
  const validPatterns = [
    /option\[\d+\]\.text\s*==\s*"[^"]*"/,
    /option\[\d+\]\.hex\s*==\s*0x[0-9A-Fa-f]+/,
    /substring\(option\[\d+\]\.text,\s*\d+,\s*\d+\)\s*==\s*"[^"]*"/,
    /member\('[^']*'\)/,
    /client\.classes\s*==\s*'[^']*'/,
  ]
  
  return validPatterns.some(pattern => pattern.test(expr))
}

function poolsOverlap(pool1: string, pool2: string): boolean {
  // Simple overlap check - would need more sophisticated logic for production
  const parsePool = (pool: string) => {
    if (pool.includes('-')) {
      const [start, end] = pool.split('-').map(ip => ip.trim())
      return { start: ipToNumber(start), end: ipToNumber(end) }
    } else {
      const num = ipToNumber(pool.trim())
      return { start: num, end: num }
    }
  }
  
  try {
    const p1 = parsePool(pool1)
    const p2 = parsePool(pool2)
    
    return !(p1.end < p2.start || p2.end < p1.start)
  } catch {
    return false
  }
}

function subnetsOverlap(subnet1: string, subnet2: string): boolean {
  // Basic subnet overlap check
  try {
    const [net1, mask1] = subnet1.split('/')
    const [net2, mask2] = subnet2.split('/')
    
    const network1 = ipToNumber(net1) & (0xFFFFFFFF << (32 - parseInt(mask1)))
    const network2 = ipToNumber(net2) & (0xFFFFFFFF << (32 - parseInt(mask2)))
    
    const size1 = Math.pow(2, 32 - parseInt(mask1))
    const size2 = Math.pow(2, 32 - parseInt(mask2))
    
    return !(network1 + size1 <= network2 || network2 + size2 <= network1)
  } catch {
    return false
  }
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
}

// Export validation functions for use in components
export const validators = {
  optionData: validateOptionData,
  optionDef: validateOptionDef,
  subnet: validateSubnet,
  clientClass: validateClientClass,
  reservation: validateReservation,
  dhcpConfig: validateDhcpConfig,
}
