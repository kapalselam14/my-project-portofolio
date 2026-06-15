import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaskCardBack from '../task/TaskCardBack'

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ currentUser: { id: 'user-1', name: 'Tester' } }),
}))

const BASE_TASK = {
  id: 'task-1',
  title: 'Fix the bug',
  type: 'p2p',
  status: 'open',
  rewardCoins: 30,
  expiredAt: '2026-07-15T00:00:00Z',
  createdBy: { id: 'user-2', name: 'Alice' },
  objectives: ['Reproduce the bug', 'Write a test', 'Submit patch'],
  timeLimit: 8,
}

function renderBack(taskOverrides = {}, props = {}) {
  const task = { ...BASE_TASK, ...taskOverrides }
  return render(
    <TaskCardBack
      task={task}
      cardColor="#fff"
      onFlip={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />
  )
}

describe('TaskCardBack', () => {
  it('renders the Details header label', () => {
    renderBack()
    expect(screen.getByText('Details')).toBeInTheDocument()
  })

  it('renders the time limit', () => {
    renderBack()
    expect(screen.getByText('8 hours')).toBeInTheDocument()
  })

  it('renders all objectives as list items', () => {
    renderBack()
    expect(screen.getByText('Reproduce the bug')).toBeInTheDocument()
    expect(screen.getByText('Write a test')).toBeInTheDocument()
    expect(screen.getByText('Submit patch')).toBeInTheDocument()
  })

  it('renders the coin reward amount', () => {
    renderBack()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders the close button', () => {
    renderBack()
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderBack({}, { onClose })
    fireEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders the flip button', () => {
    renderBack()
    expect(screen.getByRole('button', { name: '↺' })).toBeInTheDocument()
  })

  it('calls onFlip when flip button is clicked', () => {
    const onFlip = vi.fn()
    renderBack({}, { onFlip })
    fireEvent.click(screen.getByRole('button', { name: '↺' }))
    expect(onFlip).toHaveBeenCalled()
  })

  it('shows "Taken by: You" when isAccepted is true', () => {
    renderBack({}, { isAccepted: true })
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('shows assignee name in creator view', () => {
    renderBack(
      { assignee: { id: 'user-3', name: 'Bob' } },
      { isCreatorView: true }
    )
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('does not show taken-by section when isQuest is true', () => {
    renderBack(
      { assignee: { id: 'user-3', name: 'Bob' } },
      { isQuest: true }
    )
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('does not show taken-by when task has no assignee', () => {
    renderBack({ assignee: null })
    expect(screen.queryByText(/taken by/i)).not.toBeInTheDocument()
  })
})
