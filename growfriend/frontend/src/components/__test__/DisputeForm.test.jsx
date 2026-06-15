import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DisputeForm from '../task/DisputeForm'

function renderForm(props = {}) {
  return render(
    <DisputeForm
      isOpen={true}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      pov="creator"
      {...props}
    />
  )
}

describe('DisputeForm', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <DisputeForm isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} pov="creator" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the form title when isOpen is true', () => {
    renderForm()
    expect(screen.getByText('Raise a Dispute')).toBeInTheDocument()
  })

  it('shows creator reasons when pov is "creator"', () => {
    renderForm({ pov: 'creator' })
    expect(screen.getByLabelText('Assignee did not complete the task')).toBeInTheDocument()
    expect(screen.getByLabelText('Result does not match the objective')).toBeInTheDocument()
    expect(screen.getByLabelText('Fake or invalid submission')).toBeInTheDocument()
  })

  it('shows assignee reasons when pov is "assignee"', () => {
    renderForm({ pov: 'assignee' })
    expect(screen.getByLabelText('Creator is not responding')).toBeInTheDocument()
    expect(screen.getByLabelText('Task does not match the description')).toBeInTheDocument()
    expect(screen.getByLabelText('Task requirements changed after acceptance')).toBeInTheDocument()
  })

  it('shows validation error when Submit is clicked without selecting a reason', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(screen.getByText(/please select a reason before submitting/i)).toBeInTheDocument()
  })

  it('clears validation error when a reason is selected', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(screen.getByText(/please select a reason before submitting/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Assignee did not complete the task'))
    expect(screen.queryByText(/please select a reason before submitting/i)).not.toBeInTheDocument()
  })

  it('calls onSubmit with selected reason and details', () => {
    const onSubmit = vi.fn()
    renderForm({ onSubmit })
    fireEvent.click(screen.getByLabelText('Assignee did not complete the task'))
    fireEvent.change(screen.getByPlaceholderText(/additional details/i), {
      target: { value: 'They ignored it.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'Assignee did not complete the task',
      details: 'They ignored it.',
    })
  })

  it('calls onSubmit with empty details when textarea is blank', () => {
    const onSubmit = vi.fn()
    renderForm({ onSubmit })
    fireEvent.click(screen.getByLabelText('Other'))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledWith({ reason: 'Other', details: '' })
  })

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn()
    renderForm({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderForm({ onClose })
    fireEvent.click(screen.getByText('Raise a Dispute').closest('.dispute-form-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('resets fields after cancel', () => {
    const onClose = vi.fn()
    renderForm({ onClose })
    fireEvent.click(screen.getByLabelText('Other'))
    fireEvent.change(screen.getByPlaceholderText(/additional details/i), {
      target: { value: 'Some details' },
    })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
