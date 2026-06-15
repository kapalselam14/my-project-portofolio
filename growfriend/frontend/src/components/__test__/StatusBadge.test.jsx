import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from '../ui/StatusBadge'

const STATUS_CASES = [
  ['open', 'Open'],
  ['active', 'Active'],
  ['rejected', 'Rejected'],
  ['pending_review', 'On Review'],
  ['pending_confirmation', 'On Review'],
  ['disputed', 'Disputed'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['expired', 'Expired'],
]

describe('StatusBadge', () => {
  it.each(STATUS_CASES)('renders "%s" as "%s"', (status, label) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('falls back to the raw status for unknown values', () => {
    render(<StatusBadge status="unknown_status" />)
    expect(screen.getByText('unknown_status')).toBeInTheDocument()
  })

  it('applies the status-specific CSS class', () => {
    render(<StatusBadge status="open" />)
    expect(screen.getByText('Open')).toHaveClass('status-badge--open')
  })
})
