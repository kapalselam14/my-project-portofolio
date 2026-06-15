import {useState} from 'react';
import '../../styles/components/CreateEditForm.css';

function CreateEditForm({ onClose, onSubmit, initialData = null }) {
  const isEdit = initialData !== null;

  const [taskType] = useState(initialData?.type ?? 'p2p');
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [instructions, setInstructions] = useState(initialData?.instructions ?? '');
  const [objectives, setObjectives] = useState(initialData?.objectives ?? ['']);
  const [timeLimit, setTimeLimit] = useState(initialData?.timeLimit ?? '');
  const [rewardCoins, setRewardCoins] = useState(initialData?.rewardCoins ?? '');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleObjectiveChange = (index, value) => {
    const updated = [...objectives];
    updated[index] = value;
    setObjectives(updated);
  };

  const addObjective = () => {
    setObjectives([...objectives, '']);
  };

  const removeObjective = (index) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const isP2P = taskType === 'p2p';

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!instructions.trim()) newErrors.instructions = 'Instructions are required';
    if (objectives.filter((o) => o.trim() !== '').length === 0)
      newErrors.objectives = 'At least one objective is required';
    if (!timeLimit || Number(timeLimit) <= 0)
      newErrors.timeLimit = 'Time limit is required';
    if (isP2P && (!rewardCoins || Number(rewardCoins) <= 0))
      newErrors.rewardCoins = 'Reward coins is required for P2P tasks';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const taskData = {
      id: initialData?.id,
      type: taskType,
      title,
      instructions,
      objectives: objectives.filter((obj) => obj.trim() !== ''),
      timeLimit: Number(timeLimit),
      rewardCoins: isP2P ? Number(rewardCoins) : 0,
      status: initialData?.status ?? 'open',
      assignee: initialData?.assignee ?? null,
      createdBy: initialData?.createdBy ?? null,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
      expiredAt:
        initialData?.expiredAt ??
        new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onSubmit(taskData);
      onClose();
    } catch (err) {
      setSubmitError(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to save task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-container" onClick={(e) => e.stopPropagation()}>

        <div className="form-header">
          <h2 className="form-title">{isEdit ? 'Edit Task' : 'Create Task'}</h2>
          <button className="form-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-body">


          <div className="form-field">
            <label className="form-label">Title</label>
            <input
              className={`form-input ${errors.title ? 'form-input--error' : ''}`}
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })); }}
              placeholder="Task title..."
            />
            {errors.title && <p className="form-error">{errors.title}</p>}
          </div>

          <div className="form-field">
            <label className="form-label">Instructions</label>
            <textarea
              className={`form-input form-textarea ${errors.instructions ? 'form-input--error' : ''}`}
              value={instructions}
              onChange={(e) => { setInstructions(e.target.value); setErrors((p) => ({ ...p, instructions: '' })); }}
              placeholder="What needs to be done..."
              rows={3}
            />
            {errors.instructions && <p className="form-error">{errors.instructions}</p>}
          </div>

          <div className="form-field">
            <label className="form-label">Objectives</label>
            {objectives.map((obj, index) => (
              <div key={index} className="form-objective-row">
                <input
                  className={`form-input ${errors.objectives ? 'form-input--error' : ''}`}
                  type="text"
                  value={obj}
                  onChange={(e) => { handleObjectiveChange(index, e.target.value); setErrors((p) => ({ ...p, objectives: '' })); }}
                  placeholder={`Objective ${index + 1}...`}
                />
                {objectives.length > 1 && (
                  <button
                    className="form-objective-remove"
                    onClick={() => removeObjective(index)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {errors.objectives && <p className="form-error">{errors.objectives}</p>}
            <button className="form-objective-add" onClick={addObjective}>
              + Add Objective
            </button>
          </div>

          <div className="form-field">
            <label className="form-label">Time Limit (hours)</label>
            <input
              className={`form-input form-input--short ${errors.timeLimit ? 'form-input--error' : ''}`}
              type="number"
              min="1"
              value={timeLimit}
              onChange={(e) => { setTimeLimit(e.target.value); setErrors((p) => ({ ...p, timeLimit: '' })); }}
              placeholder="e.g. 2"
            />
            {errors.timeLimit && <p className="form-error">{errors.timeLimit}</p>}
          </div>

          {isP2P && (
            <div className="form-field">
              <label className="form-label">Reward Coins</label>
              <input
                className={`form-input form-input--short ${errors.rewardCoins ? 'form-input--error' : ''}`}
                type="number"
                min="1"
                value={rewardCoins}
                onChange={(e) => { setRewardCoins(e.target.value); setErrors((p) => ({ ...p, rewardCoins: '' })); }}
                placeholder="e.g. 10"
              />
              {errors.rewardCoins && <p className="form-error">{errors.rewardCoins}</p>}
              <p className="form-reward-note">
                * A bond of equal coins will be locked from your wallet when you
                create this task. Coins are returned if the task is cancelled.
              </p>
            </div>
          )}

        </div>

        <div className="form-footer">
          {submitError && <p className="form-error" style={{ marginBottom: '8px' }}>{submitError}</p>}
          <button className="form-btn form-btn--submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Done' : 'Create'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default CreateEditForm;
