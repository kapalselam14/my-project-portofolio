import { useState } from 'react'
import '../../styles/components/DisputeForm.css'

const CREATOR_REASONS = [
  'Assignee did not complete the task',
  'Result does not match the objective',
  'Fake or invalid submission',
  'Other',
]

const ASSIGNEE_REASONS = [
  'Creator is not responding',
  'Task does not match the description',
  'Task requirements changed after acceptance',
  'Other',
]

function DisputeForm({ isOpen, onClose, onSubmit, pov }) {
  const [selectedReason, setSelectedReason] = useState('')
  const [details, setDetails] = useState('')
  const [showError, setShowError] = useState(false)

  if (!isOpen) return null

  const reasons = pov === 'creator' ? CREATOR_REASONS : ASSIGNEE_REASONS

  const handleClose = () => {
    setSelectedReason('')
    setDetails('')
    setShowError(false)
    onClose()
  }

  const handleSubmit = () => {
    if (!selectedReason) {
      setShowError(true)
      return
    }
    onSubmit({ reason: selectedReason, details })
    setSelectedReason('')
    setDetails('')
    setShowError(false)
  }

  return (
    <div className="dispute-form-backdrop" onClick={handleClose}>
      <div className="dispute-form" onClick={(e) => e.stopPropagation()}>
        <h3 className="dispute-form-title">Raise a Dispute</h3>
        <p className="dispute-form-subtitle">Select a reason:</p>
        <div className="dispute-form-reasons">
          {reasons.map((r) => (
            <label key={r} className="dispute-form-reason">
              <input
                type="radio"
                name="dispute-reason"
                value={r}
                checked={selectedReason === r}
                onChange={() => { setSelectedReason(r); setShowError(false) }}
              />
              {r}
            </label>
          ))}
        </div>
        {showError && (
          <p className="dispute-form-error">Please select a reason before submitting.</p>
        )}
        <textarea
          className="dispute-form-textarea"
          placeholder="Additional details (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
        />
        <div className="dispute-form-actions">
          <button
            className="dispute-form-btn dispute-form-btn--submit"
            onClick={handleSubmit}
          >
            Submit
          </button>
          <button
            className="dispute-form-btn dispute-form-btn--cancel"
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default DisputeForm
