import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DashboardHeader from '../dashboard/DashboardHeader'

vi.mock('../userconfig/UserMenu', () => ({
  default: () => <div data-testid="user-menu" />,
}))

describe('DashboardHeader', () => {
  it('renders the app title', () => {
    render(<DashboardHeader coins={0} />)
    expect(screen.getByText(/GrowFriend/i)).toBeInTheDocument()
  })

  it('displays the coin amount via CoinBadge', () => {
    render(<DashboardHeader coins={150} />)
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('defaults to zero coins when no prop is provided', () => {
    render(<DashboardHeader />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders the UserMenu', () => {
    render(<DashboardHeader coins={0} />)
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
  })

  it('renders a header element', () => {
    const { container } = render(<DashboardHeader coins={0} />)
    expect(container.querySelector('header')).toBeInTheDocument()
  })

  it('renders the coin icon', () => {
    render(<DashboardHeader coins={50} />)
    expect(screen.getByAltText('Coin')).toBeInTheDocument()
  })
})
