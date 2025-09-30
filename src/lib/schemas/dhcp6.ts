import { z } from 'zod'

// IPv6 address validation
const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$/
const ipv6PrefixRegex = /^(?:[0-9a-fA-F]{1,4}:){0,7}[0-9a-fA-F]{0,4}\/(?:[0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/
const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
const duidRegex = /^[0-9A-Fa-f:]+$/

// DHCPv6 option types
export const Option6Type = z.enum([
  'empty',
  'uint8',
  'uint16',
  'uint32',
  'int8',
  'int16',
  'int32',
  'string',
  'fqdn',
  'ipv6-address',
  'ipv6-prefix',
  'psid',
  'tuple',
  'record',
  'binary'
])

// DHCPv6 option spaces
export const Option6Space = z.enum([
  'dhcp6',
  'vendor-4491', // CableLabs
  'vendor-25506', // Ubiquiti
  'vendor-311', // Microsoft
  'vendor-3561', // Cisco
])

// Standard DHCPv6 option codes
/* const STANDARD_OPTION6_CODES = {
  1: 'clientid',
  2: 'serverid',
  3: 'ia-na',
  4: 'ia-ta',
  5: 'iaaddr',
  6: 'oro',
  7: 'preference',
  8: 'elapsed-time',
  9: 'relay-msg',
  11: 'auth',
  12: 'unicast',
  13: 'status-code',
  14: 'rapid-commit',
  15: 'user-class',
  16: 'vendor-class',
  17: 'vendor-opts',
  18: 'interface-id',
  19: 'reconf-msg',
  20: 'reconf-accept',
  21: 'sip-server-dns',
  22: 'sip-server-addr',
  23: 'dns-servers',
  24: 'domain-search',
  25: 'ia-pd',
  26: 'iaprefix',
  27: 'nis-servers',
  28: 'nisp-servers',
  29: 'nis-domain-name',
  30: 'nisp-domain-name',
  31: 'sntp-servers',
  32: 'information-refresh-time',
  33: 'bcmcs-server-dns',
  34: 'bcmcs-server-addr',
  36: 'geoconf-civic',
  37: 'remote-id',
  38: 'subscriber-id',
  39: 'client-fqdn'
} as const */

// DHCPv6 option definition
export const Option6Def = z.object({
  name: z.string().min(1, 'Option name is required'),
  code: z.number().int().min(1).max(65535, 'Option code must be between 1-65535'),
  type: Option6Type,
  space: Option6Space.default('dhcp6'),
  'record-types': z.string().optional(),
  'encapsulate': z.string().optional(),
  array: z.boolean().optional(),
})

// DHCPv6 option data
export const Option6Data = z.object({
  name: z.string().optional(),
  code: z.number().int().min(1).max(65535).optional(),
  data: z.string().min(1, 'Option data is required'),
  space: Option6Space.default('dhcp6'),
  'always-send': z.boolean().optional(),
  'never-send': z.boolean().optional(),
  'csv-format': z.boolean().optional(),
}).refine((data) => {
  return data.name || data.code
}, {
  message: 'Either option name or code must be specified'
})

// DHCPv6 pool for IA_NA (non-temporary addresses)
export const Pool6 = z.object({
  pool: z.string().refine((pool) => {
    // Validate IPv6 pool format: start-end or prefix
    if (pool.includes('-')) {
      const [start, end] = pool.split('-')
      return ipv6Regex.test(start.trim()) && ipv6Regex.test(end.trim())
    }
    return ipv6PrefixRegex.test(pool.trim())
  }, 'Invalid IPv6 pool format. Use "start-end" or prefix/length'),
  'client-class': z.string().optional(),
  'require-client-classes': z.array(z.string()).optional(),
  'option-data': z.array(Option6Data).optional(),
})

// DHCPv6 prefix delegation pool
export const PdPool = z.object({
  prefix: z.string().refine((prefix) => ipv6PrefixRegex.test(prefix), 'Invalid IPv6 prefix format'),
  'prefix-len': z.number().int().min(1).max(128),
  'delegated-len': z.number().int().min(1).max(128),
  'client-class': z.string().optional(),
  'require-client-classes': z.array(z.string()).optional(),
  'option-data': z.array(Option6Data).optional(),
}).refine((data) => {
  return data['delegated-len'] >= data['prefix-len']
}, {
  message: 'Delegated length must be greater than or equal to prefix length'
})

// DHCPv6 subnet
export const Subnet6 = z.object({
  id: z.number().int().min(1).optional(),
  subnet: z.string().refine((subnet) => ipv6PrefixRegex.test(subnet), 'Invalid IPv6 prefix format'),
  pools: z.array(Pool6).default([]),
  'pd-pools': z.array(PdPool).default([]),
  'option-data': z.array(Option6Data).optional(),
  'client-class': z.string().optional(),
  'require-client-classes': z.array(z.string()).optional(),
  'preferred-lifetime': z.number().int().min(0).optional(),
  'valid-lifetime': z.number().int().min(0).optional(),
  'renew-timer': z.number().int().min(0).optional(),
  'rebind-timer': z.number().int().min(0).optional(),
  'rapid-commit': z.boolean().optional(),
  relay: z.object({
    'ip-addresses': z.array(z.string().refine((ip) => ipv6Regex.test(ip), 'Invalid IPv6 address'))
  }).optional(),
})

// DHCPv6 client class
export const ClientClass6 = z.object({
  name: z.string().min(1, 'Class name is required').refine((name) => {
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)
  }, 'Invalid class name format'),
  test: z.string().min(1, 'Test expression is required'),
  'option-data': z.array(Option6Data).optional(),
  'only-if-required': z.boolean().optional(),
})

// DHCPv6 reservation
export const Reservation6 = z.object({
  duid: z.string().refine((duid) => duidRegex.test(duid), 'Invalid DUID format').optional(),
  'hw-address': z.string().refine((mac) => macRegex.test(mac), 'Invalid MAC address format').optional(),
  'ip-addresses': z.array(z.string().refine((ip) => ipv6Regex.test(ip), 'Invalid IPv6 address')).optional(),
  prefixes: z.array(z.string().refine((prefix) => ipv6PrefixRegex.test(prefix), 'Invalid IPv6 prefix')).optional(),
  hostname: z.string().optional(),
  'option-data': z.array(Option6Data).optional(),
}).refine((data) => {
  return data.duid || data['hw-address']
}, {
  message: 'Either DUID or MAC address must be specified'
})

// DHCPv6 shared network
export const SharedNetwork6 = z.object({
  name: z.string().min(1, 'Shared network name is required').refine((name) => {
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)
  }, 'Invalid shared network name format'),
  subnet6: z.array(Subnet6),
  'option-data': z.array(Option6Data).optional(),
  'client-class': z.string().optional(),
  'require-client-classes': z.array(z.string()).optional(),
  'preferred-lifetime': z.number().int().min(0).optional(),
  'valid-lifetime': z.number().int().min(0).optional(),
  'renew-timer': z.number().int().min(0).optional(),
  'rebind-timer': z.number().int().min(0).optional(),
  'rapid-commit': z.boolean().optional(),
  relay: z.object({
    'ip-addresses': z.array(z.string().refine((ip) => ipv6Regex.test(ip), 'Invalid IPv6 address'))
  }).optional(),
})

// Main DHCPv6 configuration
export const Dhcp6Config = z.object({
  subnet6: z.array(Subnet6).default([]),
  'shared-networks': z.array(SharedNetwork6).optional(),
  'option-def': z.array(Option6Def).optional(),
  'option-data': z.array(Option6Data).optional(),
  'client-classes': z.array(ClientClass6).optional(),
  reservations: z.array(Reservation6).optional(),
  'preferred-lifetime': z.number().int().min(0).optional(),
  'valid-lifetime': z.number().int().min(0).optional(),
  'renew-timer': z.number().int().min(0).optional(),
  'rebind-timer': z.number().int().min(0).optional(),
  'decline-probation-period': z.number().int().min(0).optional(),
  'dhcp4o6-port': z.number().int().min(1).max(65535).optional(),
  'lease-database': z.object({
    type: z.enum(['memfile', 'mysql', 'postgresql']),
    name: z.string().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  'hosts-database': z.object({
    type: z.enum(['mysql', 'postgresql']),
    name: z.string(),
    host: z.string().optional(),
    port: z.number().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
    readonly: z.boolean().optional(),
  }).optional(),
})

// DHCPv6 lease
export const Lease6 = z.object({
  'ip-address': z.string().optional(),
  duid: z.string().optional(),
  'valid-lft': z.number().optional(),
  'cltt': z.number().optional(),
  'subnet-id': z.number().optional(),
  'pref-lft': z.number().optional(),
  'lease-type': z.enum(['IA_NA', 'IA_TA', 'IA_PD']).optional(),
  'iaid': z.number().optional(),
  'prefix-len': z.number().optional(),
  hostname: z.string().optional(),
  'fqdn-fwd': z.boolean().optional(),
  'fqdn-rev': z.boolean().optional(),
  state: z.number().int().min(0).max(4).optional(),
})

// Validation helper functions
export function validateOption6Codes(options: z.infer<typeof Option6Data>[]): string[] {
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

export function validateSubnet6Pools(_subnet: z.infer<typeof Subnet6>): string[] {
  const errors: string[] = []
  // Additional pool validation logic can be added here
  return errors
}

// Type exports
export type Pool6T = z.infer<typeof Pool6>
export type PdPoolT = z.infer<typeof PdPool>
export type Subnet6T = z.infer<typeof Subnet6>
export type SharedNetwork6T = z.infer<typeof SharedNetwork6>
export type Dhcp6ConfigT = z.infer<typeof Dhcp6Config>
export type Lease6T = z.infer<typeof Lease6>
export type Option6DataT = z.infer<typeof Option6Data>
export type Option6DefT = z.infer<typeof Option6Def>
export type ClientClass6T = z.infer<typeof ClientClass6>
export type Reservation6T = z.infer<typeof Reservation6>
