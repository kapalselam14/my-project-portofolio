import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaskGrid from '../task/TaskGrid'

vi.mock('../task/TaskCard', () => ({
  default: ({ task, isEditMode, isDeleteMode }) => (
    <div
      data-testid="task-card"
      data-task-id={task.id}
      data-edit={String(isEditMode)}
      data-delete={String(isDeleteMode)}
    />
  ),
}))

const TASKS = [
  { id: 'task-1', title: 'Task One' },
  { id: 'task-2', title: 'Task Two' },
  { id: 'task-3', title: 'Task Three' },
]

describe('TaskGrid', () => {
  it('renders the correct number of task cards', () => {
    render(<TaskGrid tasks={TASKS} />)
    expect(screen.getAllByTestId('task-card')).toHaveLength(3)
  })

  it('renders nothing when tasks array is empty', () => {
    render(<TaskGrid tasks={[]} />)
    expect(screen.queryByTestId('task-card')).not.toBeInTheDocument()
  })

  it('shows the create slot when isCreatorView and onCreateClick are provided', () => {
    render(<TaskGrid tasks={[]} isCreatorView onCreateClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /\+/ })).toBeInTheDocument()
  })

  it('does not show create slot when isCreatorView is false', () => {
    render(<TaskGrid tasks={[]} isCreatorView={false} onCreateClick={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /\+/ })).not.toBeInTheDocument()
  })

  it('does not show create slot when onCreateClick is not provided', () => {
    render(<TaskGrid tasks={[]} isCreatorView />)
    expect(screen.queryByRole('button', { name: /\+/ })).not.toBeInTheDocument()
  })

  it('calls onCreateClick when create slot is clicked', () => {
    const onCreateClick = vi.fn()
    render(<TaskGrid tasks={[]} isCreatorView onCreateClick={onCreateClick} />)
    fireEvent.click(screen.getByRole('button', { name: /\+/ }))
    expect(onCreateClick).toHaveBeenCalled()
  })

  it('passes isEditMode down to task cards', () => {
    render(<TaskGrid tasks={TASKS} isEditMode />)
    screen.getAllByTestId('task-card').forEach((card) => {
      expect(card).toHaveAttribute('data-edit', 'true')
    })
  })

  it('passes isDeleteMode down to task cards', () => {
    render(<TaskGrid tasks={TASKS} isDeleteMode />)
    screen.getAllByTestId('task-card').forEach((card) => {
      expect(card).toHaveAttribute('data-delete', 'true')
    })
  })
})
