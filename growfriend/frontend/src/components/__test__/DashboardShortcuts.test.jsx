import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DashboardShortcuts from '../dashboard/DashboardShortcuts'

describe('DashboardShortcuts', () => {
  it('renders five shortcut buttons', () => {
    render(<DashboardShortcuts openModal={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('renders a button for each shortcut with its aria-label', () => {
    render(<DashboardShortcuts openModal={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'P2P Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'System Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inventory' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Store' })).toBeInTheDocument()
  })

  it('calls openModal("p2p") when P2P Tasks is clicked', () => {
    const openModal = vi.fn()
    render(<DashboardShortcuts openModal={openModal} />)
    fireEvent.click(screen.getByRole('button', { name: 'P2P Tasks' }))
    expect(openModal).toHaveBeenCalledWith('p2p')
  })

  it('calls openModal("system") when System Tasks is clicked', () => {
    const openModal = vi.fn()
    render(<DashboardShortcuts openModal={openModal} />)
    fireEvent.click(screen.getByRole('button', { name: 'System Tasks' }))
    expect(openModal).toHaveBeenCalledWith('system')
  })

  it('calls openModal("mytask") when My Tasks is clicked', () => {
    const openModal = vi.fn()
    render(<DashboardShortcuts openModal={openModal} />)
    fireEvent.click(screen.getByRole('button', { name: 'My Tasks' }))
    expect(openModal).toHaveBeenCalledWith('mytask')
  })

  it('calls openModal("inventory") when Inventory is clicked', () => {
    const openModal = vi.fn()
    render(<DashboardShortcuts openModal={openModal} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    expect(openModal).toHaveBeenCalledWith('inventory')
  })

  it('calls openModal("store") when Store is clicked', () => {
    const openModal = vi.fn()
    render(<DashboardShortcuts openModal={openModal} />)
    fireEvent.click(screen.getByRole('button', { name: 'Store' }))
    expect(openModal).toHaveBeenCalledWith('store')
  })

  it('renders tooltip text for each shortcut', () => {
    render(<DashboardShortcuts openModal={vi.fn()} />)
    expect(screen.getByText('P2P Tasks')).toBeInTheDocument()
    expect(screen.getByText('System Tasks')).toBeInTheDocument()
    expect(screen.getByText('My Tasks')).toBeInTheDocument()
    expect(screen.getByText('Inventory')).toBeInTheDocument()
    expect(screen.getByText('Store')).toBeInTheDocument()
  })
})
