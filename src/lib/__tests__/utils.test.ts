import { describe, it, expect } from 'vitest'
import { cn, formatBytes } from '../utils'

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('combines class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('handles conditional classes', () => {
      expect(cn('base', true && 'conditional', false && 'hidden')).toBe('base conditional')
    })

    it('handles undefined and null values', () => {
      expect(cn('base', undefined, null, 'end')).toBe('base end')
    })

    it('merges tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-3')).toBe('py-1 px-3')
    })
  })

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1048576)).toBe('1 MB')
      expect(formatBytes(1073741824)).toBe('1 GB')
    })

    it('handles decimal formatting', () => {
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(2048)).toBe('2 KB')
    })

    it('handles large numbers', () => {
      expect(formatBytes(1099511627776)).toBe('1 TB')
    })

    it('handles small numbers', () => {
      expect(formatBytes(512)).toBe('512 Bytes')
      expect(formatBytes(1)).toBe('1 Bytes')
    })
  })
})
