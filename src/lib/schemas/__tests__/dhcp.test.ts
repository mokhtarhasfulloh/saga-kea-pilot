import { describe, it, expect } from 'vitest'
import { Subnet, Reservation, OptionData, Pool, ClientClass, validateOptionCodes } from '../dhcp'

describe('DHCP Schemas', () => {
  describe('Subnet', () => {
    it('validates a correct subnet configuration', () => {
      const validSubnet = {
        subnet: '192.168.1.0/24',
        pools: [{ pool: '192.168.1.100-192.168.1.200' }],
        'option-data': [
          { name: 'routers', data: '192.168.1.1' },
          { name: 'domain-name-servers', data: '8.8.8.8, 8.8.4.4' }
        ]
      }

      const result = Subnet.safeParse(validSubnet)
      expect(result.success).toBe(true)
    })

    it('rejects invalid subnet CIDR', () => {
      const invalidSubnet = {
        subnet: '192.168.1.0/33', // Invalid CIDR
        pools: [{ pool: '192.168.1.100-192.168.1.200' }]
      }

      const result = Subnet.safeParse(invalidSubnet)
      expect(result.success).toBe(false)
    })

    it('allows empty pools array', () => {
      const subnetWithoutPools = {
        subnet: '192.168.1.0/24',
        pools: []
      }

      const result = Subnet.safeParse(subnetWithoutPools)
      expect(result.success).toBe(true)
    })
  })

  describe('Pool', () => {
    it('validates pool with range format', () => {
      const validPool = {
        pool: '192.168.1.100-192.168.1.200'
      }

      const result = Pool.safeParse(validPool)
      expect(result.success).toBe(true)
    })

    it('validates pool with single IP', () => {
      const validPool = {
        pool: '192.168.1.100'
      }

      const result = Pool.safeParse(validPool)
      expect(result.success).toBe(true)
    })

    it('rejects invalid pool format', () => {
      const invalidPool = {
        pool: '192.168.1.100-invalid-ip'
      }

      const result = Pool.safeParse(invalidPool)
      expect(result.success).toBe(false)
    })
  })

  describe('Reservation', () => {
    it('validates a correct host reservation', () => {
      const validReservation = {
        'hw-address': 'aa:bb:cc:dd:ee:ff',
        'ip-address': '192.168.1.50',
        hostname: 'server.example.com'
      }

      const result = Reservation.safeParse(validReservation)
      expect(result.success).toBe(true)
    })

    it('validates MAC address format', () => {
      const invalidMac = {
        'hw-address': 'invalid-mac',
        'ip-address': '192.168.1.50'
      }

      const result = Reservation.safeParse(invalidMac)
      expect(result.success).toBe(false)
    })

    it('validates IP address format', () => {
      const invalidIP = {
        'hw-address': 'aa:bb:cc:dd:ee:ff',
        'ip-address': '256.1.1.1'
      }

      const result = Reservation.safeParse(invalidIP)
      expect(result.success).toBe(false)
    })
  })

  describe('OptionData', () => {
    it('validates standard DHCP options', () => {
      const validOption = {
        name: 'routers',
        data: '192.168.1.1'
      }

      const result = OptionData.safeParse(validOption)
      expect(result.success).toBe(true)
    })

    it('validates options with code numbers', () => {
      const validOption = {
        code: 43,
        data: '0104c0a80101'
      }

      const result = OptionData.safeParse(validOption)
      expect(result.success).toBe(true)
    })

    it('requires either name or code', () => {
      const invalidOption = {
        data: '192.168.1.1'
        // Missing both name and code
      }

      const result = OptionData.safeParse(invalidOption)
      expect(result.success).toBe(false)
    })
  })

  describe('ClientClass', () => {
    it('validates a correct client class', () => {
      const validClass = {
        name: 'vendor-class-ubiquiti',
        test: 'option[60].text == "ubnt"'
      }

      const result = ClientClass.safeParse(validClass)
      expect(result.success).toBe(true)
    })

    it('rejects invalid class names', () => {
      const invalidClass = {
        name: '123-invalid', // Cannot start with number
        test: 'option[60].text == "test"'
      }

      const result = ClientClass.safeParse(invalidClass)
      expect(result.success).toBe(false)
    })
  })

  describe('validateOptionCodes', () => {
    it('detects duplicate option codes', () => {
      const options = [
        { code: 43, data: 'test1' },
        { code: 43, data: 'test2' }
      ]

      const errors = validateOptionCodes(options)
      expect(errors).toContain('Duplicate option code: 43')
    })

    it('detects duplicate option names', () => {
      const options = [
        { name: 'routers', data: '192.168.1.1' },
        { name: 'routers', data: '192.168.1.2' }
      ]

      const errors = validateOptionCodes(options)
      expect(errors).toContain('Duplicate option name: routers')
    })

    it('allows unique options', () => {
      const options = [
        { name: 'routers', data: '192.168.1.1' },
        { code: 43, data: 'test' }
      ]

      const errors = validateOptionCodes(options)
      expect(errors).toHaveLength(0)
    })
  })
})
