import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusChip from '../ui/StatusChip'

describe('StatusChip', () => {
  it('renders healthy status correctly', () => {
    render(<StatusChip status="healthy" label="Active" />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    const chip = screen.getByText('Active').closest('span')
    expect(chip).toHaveClass('bg-green-50')
  })

  it('renders error status correctly', () => {
    render(<StatusChip status="error" label="Failed" />)

    expect(screen.getByText('Failed')).toBeInTheDocument()
    const chip = screen.getByText('Failed').closest('span')
    expect(chip).toHaveClass('bg-red-50')
  })

  it('renders warning status correctly', () => {
    render(<StatusChip status="warning" label="Pending" />)

    expect(screen.getByText('Pending')).toBeInTheDocument()
    const chip = screen.getByText('Pending').closest('span')
    expect(chip).toHaveClass('bg-yellow-50')
  })

  it('renders unknown status correctly', () => {
    render(<StatusChip status="unknown" label="Processing" />)

    expect(screen.getByText('Processing')).toBeInTheDocument()
    const chip = screen.getByText('Processing').closest('span')
    expect(chip).toHaveClass('bg-gray-50')
  })

  it('renders default label when no label provided', () => {
    render(<StatusChip status="healthy" />)

    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('shows status dot when showDot is true', () => {
    render(<StatusChip status="healthy" showDot={true} />)

    const dot = document.querySelector('.bg-green-500')
    expect(dot).toBeInTheDocument()
  })
})
