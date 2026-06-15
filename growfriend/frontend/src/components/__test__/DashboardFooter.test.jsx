import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DashboardFooter from '../dashboard/DashboardFooter'

vi.mock('../dashboard/DashboardShortcuts', () => ({
  default: ({ openModal }) => (
    <div data-testid="shortcuts" onClick={() => openModal?.('p2p')} />
  ),
}))

describe('DashboardFooter', () => {
  it('renders copyright text', () => {
    render(<DashboardFooter openModal={vi.fn()} />)
    expect(screen.getByText(/2026 GrowFriend/)).toBeInTheDocument()
  })

  it('renders the DashboardShortcuts component', () => {
    render(<DashboardFooter openModal={vi.fn()} />)
    expect(screen.getByTestId('shortcuts')).toBeInTheDocument()
  })

  it('renders a footer element', () => {
    const { container } = render(<DashboardFooter openModal={vi.fn()} />)
    expect(container.querySelector('footer')).toBeInTheDocument()
  })

  it('passes openModal to DashboardShortcuts', () => {
    const openModal = vi.fn()
    render(<DashboardFooter openModal={openModal} />)
    screen.getByTestId('shortcuts').click()
    expect(openModal).toHaveBeenCalledWith('p2p')
  })
})
