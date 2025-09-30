import { describe, it, expect } from 'vitest'
import { ipToInt, parsePool, cidrRange, poolWithinCidr, poolsOverlap } from '../ip'

describe('IP Utilities', () => {
  describe('ipToInt', () => {
    it('converts IPv4 addresses to integers correctly', () => {
      expect(ipToInt('192.168.1.1')).toBe(3232235777)
      expect(ipToInt('10.0.0.1')).toBe(167772161)
      expect(ipToInt('172.16.0.1')).toBe(2886729729)
      expect(ipToInt('255.255.255.255')).toBe(4294967295)
      expect(ipToInt('0.0.0.0')).toBe(0)
    })

    it('throws error for invalid IPv4 addresses', () => {
      expect(() => ipToInt('256.1.1.1')).toThrow('Invalid IPv4')
      expect(() => ipToInt('192.168.1')).toThrow('Invalid IPv4')
      expect(() => ipToInt('192.168.1.1.1')).toThrow('Invalid IPv4')
      expect(() => ipToInt('not.an.ip.address')).toThrow('Invalid IPv4')
      expect(() => ipToInt('')).toThrow('Invalid IPv4')
    })
  })

  describe('parsePool', () => {
    it('parses valid IP pools correctly', () => {
      expect(parsePool('192.168.1.100-192.168.1.200')).toEqual([
        ipToInt('192.168.1.100'),
        ipToInt('192.168.1.200')
      ])
      expect(parsePool('10.0.0.1 - 10.0.0.10')).toEqual([
        ipToInt('10.0.0.1'),
        ipToInt('10.0.0.10')
      ])
    })

    it('throws error for invalid pools', () => {
      expect(() => parsePool('192.168.1.100')).toThrow('Pool must be start-end')
      expect(() => parsePool('192.168.1.200-192.168.1.100')).toThrow('Pool start must be <= end')
    })
  })

  describe('cidrRange', () => {
    it('calculates CIDR ranges correctly', () => {
      const [network, broadcast] = cidrRange('192.168.1.0/24')
      expect(network).toBe(ipToInt('192.168.1.0'))
      expect(broadcast).toBe(ipToInt('192.168.1.255'))
    })

    it('handles /30 networks correctly', () => {
      const [network, broadcast] = cidrRange('192.168.1.0/30')
      expect(network).toBe(ipToInt('192.168.1.0'))
      expect(broadcast).toBe(ipToInt('192.168.1.3'))
    })

    it('throws error for invalid CIDR', () => {
      expect(() => cidrRange('192.168.1.0/33')).toThrow('Invalid CIDR')
      expect(() => cidrRange('192.168.1.0/-1')).toThrow('Invalid CIDR')
      expect(() => cidrRange('192.168.1.0')).toThrow('Invalid CIDR')
    })
  })

  describe('poolWithinCidr', () => {
    it('validates pools within CIDR ranges', () => {
      expect(poolWithinCidr('192.168.1.100-192.168.1.200', '192.168.1.0/24')).toBe(true)
      expect(poolWithinCidr('192.168.1.1-192.168.1.254', '192.168.1.0/24')).toBe(true)
    })

    it('rejects pools outside CIDR ranges', () => {
      expect(poolWithinCidr('192.168.2.100-192.168.2.200', '192.168.1.0/24')).toBe(false)
      expect(poolWithinCidr('192.168.1.100-192.168.2.100', '192.168.1.0/24')).toBe(false)
    })
  })

  describe('poolsOverlap', () => {
    it('detects overlapping pools', () => {
      expect(poolsOverlap([
        '192.168.1.100-192.168.1.150',
        '192.168.1.140-192.168.1.200'
      ])).toBe(true)
    })

    it('allows non-overlapping pools', () => {
      expect(poolsOverlap([
        '192.168.1.100-192.168.1.150',
        '192.168.1.151-192.168.1.200'
      ])).toBe(false)
    })

    it('handles single pool', () => {
      expect(poolsOverlap(['192.168.1.100-192.168.1.200'])).toBe(false)
    })
  })
})
