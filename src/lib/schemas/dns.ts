import { z } from 'zod'

// DNS record types
export const DnsRecordType = z.enum([
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'NS',
  'PTR',
  'SOA',
  'SRV',
  'TXT',
  'CAA'
])

// Zone configuration
export const Zone = z.object({
  name: z.string().min(1, 'Zone name is required'),
  serial: z.number().optional(),
  refresh: z.number().default(3600),
  retry: z.number().default(1800),
  expire: z.number().default(604800),
  minimum: z.number().default(86400),
  primaryNs: z.string().optional(),
  adminEmail: z.string().optional(),
  type: z.enum(['master', 'slave', 'forward']).default('master'),
  file: z.string().optional(),
  masters: z.array(z.string()).optional()
})

// DNS record validation
export const DnsRecord = z.object({
  zone: z.string().min(1, 'Zone is required'),
  name: z.string().min(1, 'Record name is required'),
  type: DnsRecordType,
  value: z.string().min(1, 'Record value is required'),
  ttl: z.number().min(1).max(2147483647).default(300),
  priority: z.number().min(0).max(65535).optional(), // For MX, SRV records
  weight: z.number().min(0).max(65535).optional(),   // For SRV records
  port: z.number().min(1).max(65535).optional()      // For SRV records
}).refine((data) => {
  // MX records require priority
  if (data.type === 'MX' && data.priority === undefined) {
    return false
  }
  // SRV records require priority, weight, and port
  if (data.type === 'SRV' && (data.priority === undefined || data.weight === undefined || data.port === undefined)) {
    return false
  }
  return true
}, {
  message: 'MX records require priority, SRV records require priority, weight, and port'
})

// Zone validation response
export const ZoneValidation = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  output: z.string().optional()
})

// DNS API responses
export const ZoneListResponse = z.object({
  zones: z.array(Zone)
})

export const RecordListResponse = z.object({
  records: z.array(DnsRecord),
  total: z.number().optional()
})

export const DnsActionResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  validation: ZoneValidation.optional()
})

// Type exports
export type ZoneT = z.infer<typeof Zone>
export type DnsRecordT = z.infer<typeof DnsRecord>
export type DnsRecordTypeT = z.infer<typeof DnsRecordType>
export type ZoneValidationT = z.infer<typeof ZoneValidation>
export type ZoneListResponseT = z.infer<typeof ZoneListResponse>
export type RecordListResponseT = z.infer<typeof RecordListResponse>
export type DnsActionResponseT = z.infer<typeof DnsActionResponse>

