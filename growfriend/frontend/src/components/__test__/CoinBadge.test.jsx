import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CoinBadge from '../ui/CoinBadge'

describe('CoinBadge', () => {
  it('renders the coin amount', () => {
    render(<CoinBadge amount={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders a coin image with alt text', () => {
    render(<CoinBadge amount={0} />)
    expect(screen.getByAltText('Coin')).toBeInTheDocument()
  })

  it('renders zero amount', () => {
    render(<CoinBadge amount={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders large coin amounts', () => {
    render(<CoinBadge amount={9999} />)
    expect(screen.getByText('9999')).toBeInTheDocument()
  })
})
