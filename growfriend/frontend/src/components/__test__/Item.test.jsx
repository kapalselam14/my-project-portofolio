import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Item from '../ui/Item'

const IMG = '/test-item.png'

describe('Item — store mode', () => {
  it('renders the item name', () => {
    render(<Item image={IMG} name="Snack" itemCode="snack" cost={10} />)
    expect(screen.getByRole('heading', { name: 'Snack' })).toBeInTheDocument()
  })

  it('renders the item cost', () => {
    render(<Item image={IMG} name="Snack" itemCode="snack" cost={10} />)
    expect(screen.getByText('10 coins')).toBeInTheDocument()
  })

  it('renders the item image with alt text', () => {
    render(<Item image={IMG} name="Meal" itemCode="meal" cost={20} />)
    expect(screen.getByAltText('Meal')).toBeInTheDocument()
  })

  it('renders the Buy button by default', () => {
    render(<Item image={IMG} name="Feast" itemCode="feast" cost={40} />)
    expect(screen.getByRole('button', { name: 'Buy' })).toBeInTheDocument()
  })

  it('renders a custom buyLabel', () => {
    render(<Item image={IMG} name="Snack" itemCode="snack" cost={10} buyLabel="Purchase" />)
    expect(screen.getByRole('button', { name: 'Purchase' })).toBeInTheDocument()
  })

  it('calls onBuy when Buy button is clicked', () => {
    const onBuy = vi.fn()
    render(<Item image={IMG} name="Snack" itemCode="snack" cost={10} onBuy={onBuy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }))
    expect(onBuy).toHaveBeenCalled()
  })

  it('disables the Buy button when disabled prop is true', () => {
    render(<Item image={IMG} name="Snack" itemCode="snack" cost={10} disabled />)
    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled()
  })

  it('renders a secondary button when secondaryLabel is provided', () => {
    render(
      <Item
        image={IMG}
        name="Snack"
        itemCode="snack"
        cost={10}
        secondaryLabel="Gift"
        onSecondary={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Gift' })).toBeInTheDocument()
  })

  it('calls onSecondary when secondary button is clicked', () => {
    const onSecondary = vi.fn()
    render(
      <Item
        image={IMG}
        name="Snack"
        itemCode="snack"
        cost={10}
        secondaryLabel="Gift"
        onSecondary={onSecondary}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Gift' }))
    expect(onSecondary).toHaveBeenCalled()
  })

  it('shows a tooltip for SNACK food items', () => {
    render(<Item image={IMG} name="Snack" itemCode="SNACK" cost={5} />)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText(/Growth Value: \+5/)).toBeInTheDocument()
  })

  it('shows a tooltip for MEAL food items', () => {
    render(<Item image={IMG} name="Meal" itemCode="MEAL" cost={15} />)
    expect(screen.getByText(/Growth Value: \+12/)).toBeInTheDocument()
  })

  it('shows a tooltip for FEAST food items', () => {
    render(<Item image={IMG} name="Feast" itemCode="FEAST" cost={30} />)
    expect(screen.getByText(/Growth Value: \+21/)).toBeInTheDocument()
  })

  it('does not show a tooltip for non-food items', () => {
    render(<Item image={IMG} name="Pet Egg" itemCode="EGG" cost={100} />)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})

describe('Item — inventory mode', () => {
  it('renders the quantity badge', () => {
    render(<Item image={IMG} name="Snack" itemCode="SNACK" cost={5} mode="inventory" quantity={3} />)
    expect(screen.getByText('x3')).toBeInTheDocument()
  })

  it('applies empty class when quantity is zero', () => {
    const { container } = render(
      <Item image={IMG} name="Snack" itemCode="SNACK" cost={5} mode="inventory" quantity={0} />
    )
    expect(container.querySelector('.item-card--empty')).toBeInTheDocument()
  })

  it('does not apply empty class when quantity is positive', () => {
    const { container } = render(
      <Item image={IMG} name="Snack" itemCode="SNACK" cost={5} mode="inventory" quantity={2} />
    )
    expect(container.querySelector('.item-card--empty')).not.toBeInTheDocument()
  })

  it('shows a tooltip for SNACK items in inventory mode', () => {
    render(<Item image={IMG} name="Snack" itemCode="SNACK" cost={5} mode="inventory" quantity={1} />)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('does not render Buy button in inventory mode', () => {
    render(<Item image={IMG} name="Snack" itemCode="SNACK" cost={5} mode="inventory" quantity={1} />)
    expect(screen.queryByRole('button', { name: /buy/i })).not.toBeInTheDocument()
  })
})
