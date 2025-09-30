import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HealthTile from '../HealthTile'

describe('HealthTile', () => {
  it('renders service name and status', () => {
    const healthData = {
      service: 'Kea DHCP',
      status: 'healthy' as const,
      lastCheck: '2024-01-15T10:30:00Z',
      message: 'Service is running normally'
    }

    render(<HealthTile health={healthData} />)

    expect(screen.getByText('Kea DHCP')).toBeInTheDocument()
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('displays service message when provided', () => {
    const healthData = {
      service: 'PostgreSQL',
      status: 'healthy' as const,
      lastCheck: '2024-01-15T10:30:00Z',
      message: 'Database connection active'
    }

    render(<HealthTile health={healthData} />)

    expect(screen.getByText('Database connection active')).toBeInTheDocument()
  })

  it('shows error status with appropriate styling', () => {
    const healthData = {
      service: 'BIND9',
      status: 'error' as const,
      lastCheck: '2024-01-15T10:30:00Z',
      message: 'Connection refused'
    }

    render(<HealthTile health={healthData} />)

    expect(screen.getByText('error')).toBeInTheDocument()
    expect(screen.getByText('Connection refused')).toBeInTheDocument()
  })

  it('handles unknown status', () => {
    const healthData = {
      service: 'Unknown Service',
      status: 'unknown' as const,
      lastCheck: '2024-01-15T10:30:00Z'
    }

    render(<HealthTile health={healthData} />)

    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})
