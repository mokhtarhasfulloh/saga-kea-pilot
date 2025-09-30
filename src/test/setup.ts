import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Extend Vitest's expect with jest-dom matchers
expect.extend({})

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock WebSocket for tests
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
})) as any

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock environment variables
vi.mock('../lib/config', () => ({
  API_BASE_URL: 'http://localhost:3001/api',
  WS_URL: 'ws://localhost:3001',
  KEA_CA_URL: 'http://localhost:8000',
}))

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
}
