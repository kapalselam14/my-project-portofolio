import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import NotificationPopup from '../ui/NotificationPopup'

describe('NotificationPopup', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders nothing when notifications array is empty', () => {
    const { container } = render(<NotificationPopup notifications={[]} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders notification messages', () => {
    const notifications = [
      { id: '1', type: 'success', message: 'Task completed!' },
      { id: '2', type: 'error', message: 'Something went wrong.' },
    ]
    render(<NotificationPopup notifications={notifications} onClose={vi.fn()} />)
    expect(screen.getByText('Task completed!')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  })

  it('applies the correct type class to each notification', () => {
    const notifications = [
      { id: '1', type: 'success', message: 'OK' },
      { id: '2', type: 'error', message: 'Fail' },
      { id: '3', type: 'info', message: 'Note' },
    ]
    render(<NotificationPopup notifications={notifications} onClose={vi.fn()} />)
    expect(screen.getByText('OK')).toHaveClass('gf-notification--success')
    expect(screen.getByText('Fail')).toHaveClass('gf-notification--error')
    expect(screen.getByText('Note')).toHaveClass('gf-notification--info')
  })

  it('defaults unknown type to info class', () => {
    const notifications = [{ id: '1', type: 'warning', message: 'Heads up' }]
    render(<NotificationPopup notifications={notifications} onClose={vi.fn()} />)
    expect(screen.getByText('Heads up')).toHaveClass('gf-notification--info')
  })

  it('calls onClose with the notification id after the duration', () => {
    const onClose = vi.fn()
    const notifications = [{ id: 'abc', type: 'success', message: 'Done' }]
    render(<NotificationPopup notifications={notifications} duration={3200} onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3200)
    expect(onClose).toHaveBeenCalledWith('abc')
  })

  it('has an accessible live region', () => {
    const notifications = [{ id: '1', type: 'info', message: 'Hello' }]
    render(<NotificationPopup notifications={notifications} onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
