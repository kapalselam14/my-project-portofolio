import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaskCardFront from '../task/TaskCardFront'

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ currentUser: { id: 'user-1', name: 'Tester' } }),
}))

vi.mock('../../services/taskService', () => ({
  disputeTask: vi.fn().mockResolvedValue({}),
}))

vi.mock('../task/DisputeForm', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="dispute-form" /> : null,
}))

const BASE_TASK = {
  id: 'task-1',
  title: 'Fix the bug',
  instructions: 'Reproduce the issue and submit a patch.',
  type: 'p2p',
  status: 'open',
  rewardCoins: 25,
  expiredAt: '2026-07-15T00:00:00Z',
  createdBy: { id: 'user-2', name: 'Alice' },
  objectives: ['Step 1', 'Step 2'],
  timeLimit: 4,
}

function renderFront(taskOverrides = {}, props = {}) {
  const task = { ...BASE_TASK, ...taskOverrides }
  return render(
    <TaskCardFront
      task={task}
      cardColor="#fff"
      onFlip={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />
  )
}

describe('TaskCardFront', () => {
  it('renders the task title', () => {
    renderFront()
    expect(screen.getByText('Fix the bug')).toBeInTheDocument()
  })

  it('renders the task instructions', () => {
    renderFront()
    expect(screen.getByText('Reproduce the issue and submit a patch.')).toBeInTheDocument()
  })

  it('renders the close button', () => {
    renderFront()
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderFront({}, { onClose })
    fireEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders the flip button', () => {
    renderFront()
    expect(screen.getByRole('button', { name: '↺' })).toBeInTheDocument()
  })

  it('calls onFlip when flip button is clicked', () => {
    const onFlip = vi.fn()
    renderFront({}, { onFlip })
    fireEvent.click(screen.getByRole('button', { name: '↺' }))
    expect(onFlip).toHaveBeenCalled()
  })

  it('renders the coin reward amount', () => {
    renderFront()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('shows posted-by text for p2p task in non-creator view', () => {
    renderFront()
    expect(screen.getByText(/Posted by: Alice/)).toBeInTheDocument()
  })

  it('shows "Me" as posted-by when current user created the task', () => {
    renderFront({ createdBy: { id: 'user-1', name: 'Tester' } })
    expect(screen.getByText(/Posted by: Me/)).toBeInTheDocument()
  })

  it('renders Accept button for open p2p task in non-creator view', () => {
    renderFront()
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument()
  })

  it('Accept button is disabled when user created the task', () => {
    renderFront({ createdBy: { id: 'user-1', name: 'Tester' } })
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeDisabled()
  })

  it('Accept button is disabled when task is already accepted', () => {
    renderFront({}, { isAccepted: true })
    expect(screen.getByRole('button', { name: /accepted!/i })).toBeDisabled()
  })

  it('shows accept confirm dialog when Accept is clicked', () => {
    renderFront()
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    expect(screen.getByText(/are you sure want to accept this task/i)).toBeInTheDocument()
  })

  it('hides accept confirm when No is clicked', () => {
    renderFront()
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }))
    expect(screen.queryByText(/are you sure want to accept this task/i)).not.toBeInTheDocument()
  })

  it('renders Edit and Delete buttons for creator view with open task', () => {
    renderFront({}, { isCreatorView: true })
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('shows waiting message for creator view with active task', () => {
    renderFront({ status: 'active' }, { isCreatorView: true })
    expect(screen.getByText(/waiting for assignee to submit/i)).toBeInTheDocument()
  })

  it('renders Confirm, Reject, and Dispute buttons for creator view with pending_review task', () => {
    renderFront({ status: 'pending_review' }, { isCreatorView: true })
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^dispute$/i })).toBeInTheDocument()
  })

  it('shows delete confirm dialog when Delete is clicked in creator view', () => {
    renderFront({}, { isCreatorView: true, onDeleteTask: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByText(/are you sure want to delete this task/i)).toBeInTheDocument()
  })

  it('shows confirm review dialog when Confirm is clicked in creator view', () => {
    renderFront({ status: 'pending_review' }, { isCreatorView: true, onUpdateTask: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }))
    expect(screen.getByText(/are you sure you want to confirm this task/i)).toBeInTheDocument()
  })
})
