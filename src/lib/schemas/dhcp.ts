import { z } from 'zod'

// IP address validation
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/
const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
const hexRegex = /^[0-9A-Fa-f]+$/

// DHCP option types as defined in RFC 2132 and others
export const OptionType = z.enum([
  'empty',
  'uint8',
  'uint16',
  'uint32',
  'int8',
  'int16',
  'int32',
  'string',
  'fqdn',
  'ipv4-address',
  'ipv6-address',
  'psid',
  'tuple',
  'record',
  'binary'
])

// DHCP option spaces
export const OptionSpace = z.enum([
  'dhcp4',
  'dhcp6',
  'vendor-encapsulated-options',
  'vendor-4491', // CableLabs
  'vendor-25506', // Ubiquiti
  'vendor-311', // Microsoft
  'vendor-3561', // Cisco
])

// Standard DHCP option codes (partial list of common ones)
const STANDARD_OPTION_CODES = {
  1: 'subnet-mask',
  3: 'routers',
  6: 'domain-name-servers',
  12: 'host-name',
  15: 'domain-name',
  42: 'ntp-servers',
  43: 'vendor-encapsulated-options',
  60: 'vendor-class-identifier',
  66: 'tftp-server-name',
  67: 'boot-file-name',
  125: 'vendor-identifying-vendor-specific-information',
  138: 'capwap-ac-v4', // MikroTik CAPsMAN
} as const

// Option definition schema
export const OptionDef = z.object({
  name: z.string().min(1, 'Option name is required'),
  code: z.number().int().min(1).max(254, 'Option code must be between 1-254'),
  type: OptionType,
  space: OptionSpace.default('dhcp4'),
  'record-types': z.string().optional(), // For record type options
  'encapsulate': z.string().optional(), // For encapsulating options
  array: z.boolean().optional(),
}).refine((data) => {
  // Validate that standard option codes match their names
  const standardName = STANDARD_OPTION_CODES[data.code as keyof typeof STANDARD_OPTION_CODES]
  if (standardName && data.name !== standardName) {
    return false
  }
  return true
}, {
  message: 'Option code does not match standard option name'
})

// Enhanced option data schema with validation
export const OptionData = z.object({
  name: z.string().optional(),
  code: z.number().int().min(1).max(254).optional(),
  data: z.string().min(1, 'Option data is required'),
  space: OptionSpace.default('dhcp4'),
  'always-send': z.boolean().optional(),
  'never-send': z.boolean().optional(),
  'csv-format': z.boolean().optional(),
}).refine((data) => {
  // Must have either name or code
  return data.name || data.code
}, {
  message: 'Either option name or code must be specified'
}).refine((data) => {
  // Validate data format based on option type
  if (data.code === 43 || data.code === 125) {
    // Vendor options should be hex
    return hexRegex.test(data.data.replace(/^0x/, ''))
  }
  return true
}, {
  message: 'Invalid data format for option type'
})

// TR-069/CWMP specific validation
export const TR069Config = z.object({
  acsUrl: z.string().url('Invalid ACS URL'),
  provisioningCode: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  periodicInformInterval: z.number().int().min(60).max(86400).optional(),
  connectionRequestUrl: z.string().url().optional(),
  connectionRequestUsername: z.string().optional(),
  connectionRequestPassword: z.string().optional(),
})

// Pool validation with client class support
export const Pool = z.object({
  pool: z.string().refine((pool) => {
    // Validate pool format: start-end or single IP
    if (pool.includes('-')) {
      const [start, end] = pool.split('-')
      return ipv4Regex.test(start.trim()) && ipv4Regex.test(end.trim())
    }
    return ipv4Regex.test(pool.trim())
  }, 'Invalid pool format. Use "start-end" or single IP'),
  'client-class': z.string().optional(),
  'require-client-classes': z.array(z.string()).optional(),
  'option-data': z.array(OptionData).optional(),
})

// Relay agent information (Option 82) configuration
export const RelayAgentInfo = z.object({
  'link-selection': z.string().refine((cidr) => cidrRegex.test(cidr), 'Invalid CIDR format').optional(),
  'server-id-override': z.boolean().optional(),
  'circuit-id': z.string().optional(),
  'remote-id': z.string().optional(),
})

// Subnet selection configuration
export const SubnetSelection = z.object({
  'giaddr-based': z.boolean().optional(),
  'client-class-based': z.boolean().optional(),
})

// Relay configuration
export const RelayConfig = z.object({
  'ip-addresses': z.array(z.string().refine((ip) => ipv4Regex.test(ip), 'Invalid IP address')),
})

// Subnet validation
export const Subnet = z.object({
  id: z.number().int().min(1).optional(),
  subnet: z.string().refine((subnet) => cidrRegex.test(subnet), 'Invalid CIDR format'),
  pools: z.array(Pool).default([]),
  'option-data': z.array(OptionData).optional(),
  'client-class': z.string().optional(),
  'require-client-classes': z.array(z.string()).optional(),
  'shared-network-name': z.string().optional(),
  relay: RelayConfig.optional(),
  'relay-agent-info': RelayAgentInfo.optional(),
  'subnet-selection': SubnetSelection.optional(),
})

// Client class validation
export const ClientClass = z.object({
  name: z.string().min(1, 'Class name is required').refine((name) => {
    // Valid identifier: letters, numbers, hyphens, underscores
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)
  }, 'Invalid class name format'),
  test: z.string().min(1, 'Test expression is required'),
  'option-data': z.array(OptionData).optional(),
  'only-if-required': z.boolean().optional(),
  'boot-file-name': z.string().optional(),
  'server-hostname': z.string().optional(),
  'next-server': z.string().refine((ip) => ipv4Regex.test(ip), 'Invalid IP address').optional(),
})

// Reservation validation
export const Reservation = z.object({
  'hw-address': z.string().refine((mac) => macRegex.test(mac), 'Invalid MAC address format'),
  'ip-address': z.string().refine((ip) => ipv4Regex.test(ip), 'Invalid IP address'),
  hostname: z.string().optional(),
  'client-id': z.string().optional(),
  'option-data': z.array(OptionData).optional(),
})

// Shared network validation
export const SharedNetwork = z.object({
  name: z.string().min(1, 'Shared network name is required').refine((name) => {
    // Valid identifier: letters, numbers, hyphens, underscores
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)
  }, 'Invalid shared network name format'),
  subnet4: z.array(Subnet),
  'option-data': z.array(OptionData).optional(),
  relay: RelayConfig.optional(),
  'client-class': z.string().optional(),
  'require-client-classes': z.array(z.string()).optional(),
})

// Main DHCP4 configuration
export const Dhcp4Config = z.object({
  subnet4: z.array(Subnet).default([]),
  'shared-networks': z.array(SharedNetwork).optional(),
  'option-def': z.array(OptionDef).optional(),
  'option-data': z.array(OptionData).optional(),
  'client-classes': z.array(ClientClass).optional(),
  reservations: z.array(Reservation).optional(),
  'lease-database': z.object({
    type: z.enum(['memfile', 'mysql', 'postgresql']),
    name: z.string().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  'hooks-libraries': z.array(z.object({
    library: z.string(),
    parameters: z.record(z.string(), z.any()).optional(),
  })).optional(),
})

// Lease schema
export const Lease = z.object({
  ipv4_address: z.string().optional(),
  address: z.string().optional(),
  hostname: z.string().optional(),
  state: z.number().int().min(0).max(4).optional(), // 0=default, 1=declined, 2=expired-reclaimed, 3=released, 4=backup
  'hw-address': z.string().optional(),
  hw_address: z.string().optional(),
  'client-id': z.string().optional(),
  'valid-lft': z.number().optional(),
  'cltt': z.number().optional(), // Client last transaction time
  'subnet-id': z.number().optional(),
  'fqdn-fwd': z.boolean().optional(),
  'fqdn-rev': z.boolean().optional(),
})

// Validation helper functions
export function validateOptionCodes(options: z.infer<typeof OptionData>[]): string[] {
  const errors: string[] = []
  const usedCodes = new Set<number>()
  const usedNames = new Set<string>()

  for (const option of options) {
    if (option.code && usedCodes.has(option.code)) {
      errors.push(`Duplicate option code: ${option.code}`)
    }
    if (option.name && usedNames.has(option.name)) {
      errors.push(`Duplicate option name: ${option.name}`)
    }

    if (option.code) usedCodes.add(option.code)
    if (option.name) usedNames.add(option.name)
  }

  return errors
}

export function validateSubnetPools(_subnet: z.infer<typeof Subnet>): string[] {
  const errors: string[] = []
  // Additional pool validation logic can be added here
  return errors
}

// Type exports
export type PoolT = z.infer<typeof Pool>
export type SubnetT = z.infer<typeof Subnet>
export type SharedNetworkT = z.infer<typeof SharedNetwork>
export type RelayConfigT = z.infer<typeof RelayConfig>
export type RelayAgentInfoT = z.infer<typeof RelayAgentInfo>
export type SubnetSelectionT = z.infer<typeof SubnetSelection>
export type Dhcp4ConfigT = z.infer<typeof Dhcp4Config>
export type LeaseT = z.infer<typeof Lease>
export type OptionDataT = z.infer<typeof OptionData>
export type OptionDefT = z.infer<typeof OptionDef>
export type ClientClassT = z.infer<typeof ClientClass>
export type ReservationT = z.infer<typeof Reservation>
export type TR069ConfigT = z.infer<typeof TR069Config>

