import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TaskCard from '../task/TaskCard'

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ currentUser: { id: 'user-1', name: 'Tester' } }),
}))

vi.mock('../task/TaskCardFront', () => ({
  default: () => <div data-testid="task-card-front" />,
}))

vi.mock('../task/TaskCardBack', () => ({
  default: () => <div data-testid="task-card-back" />,
}))

const BASE_TASK = {
  id: 'task-1',
  title: 'Fix the bug',
  instructions: 'Reproduce the issue and submit a patch.',
  status: 'open',
  type: 'personal',
  rewardCoins: 25,
  expiredAt: '2026-07-15T00:00:00Z',
  createdBy: { id: 'user-2', name: 'Alice' },
}

function renderCard(props = {}) {
  return render(<TaskCard task={BASE_TASK} index={0} {...props} />)
}

describe('TaskCard', () => {
  it('renders the task title', () => {
    renderCard()
    expect(screen.getByText('Fix the bug')).toBeInTheDocument()
  })

  it('renders the task instructions', () => {
    renderCard()
    expect(screen.getByText('Reproduce the issue and submit a patch.')).toBeInTheDocument()
  })

  it('renders the coin reward amount', () => {
    renderCard()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('renders the Details button', () => {
    renderCard()
    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument()
  })

  it('shows the expanded overlay when Details is clicked', async () => {
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByTestId('task-card-front')).toBeInTheDocument()
    expect(screen.getByTestId('task-card-back')).toBeInTheDocument()
  })

  it('shows the delete button on hover in delete mode', () => {
    renderCard({ isDeleteMode: true })
    fireEvent.mouseEnter(screen.getByText('Fix the bug').closest('.task-card-small'))
    expect(screen.getByRole('button', { name: /🗑/i })).toBeInTheDocument()
  })

  it('shows delete confirm dialog after clicking the delete button', () => {
    renderCard({ isDeleteMode: true, onDelete: vi.fn() })
    fireEvent.mouseEnter(screen.getByText('Fix the bug').closest('.task-card-small'))
    fireEvent.click(screen.getByRole('button', { name: /🗑/i }))
    expect(screen.getByText('Delete this task?')).toBeInTheDocument()
  })

  it('dismisses the delete confirm dialog on "No"', () => {
    renderCard({ isDeleteMode: true, onDelete: vi.fn() })
    fireEvent.mouseEnter(screen.getByText('Fix the bug').closest('.task-card-small'))
    fireEvent.click(screen.getByRole('button', { name: /🗑/i }))
    fireEvent.click(screen.getByRole('button', { name: /no/i }))
    expect(screen.queryByText('Delete this task?')).not.toBeInTheDocument()
  })

  it('shows edit button on hover in edit mode for open tasks', () => {
    const onEdit = vi.fn()
    renderCard({ isEditMode: true, onEdit })
    fireEvent.mouseEnter(screen.getByText('Fix the bug').closest('.task-card-small'))
    const editBtn = screen.getByRole('button', { name: /edit/i })
    expect(editBtn).toBeInTheDocument()
    fireEvent.click(editBtn)
    expect(onEdit).toHaveBeenCalledWith(BASE_TASK)
  })
})
