import { useState } from 'react';
import '../../styles/components/CreateEditForm.css';

export default function AdminEditForm({ task, onClose, onSubmit, submitError, isSubmitting = false }) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.instructions);
    const [objectives, setObjectives] = useState(
        task.objectives?.length ? task.objectives : ['']
    );
    const [timeLimit, setTimeLimit] = useState(String(task.timeLimit));
    const [rewardCoins, setRewardCoins] = useState(String(task.rewardCoins));
    const [errors, setErrors] = useState({});

    function handleObjectiveChange(index, value) {
        const updated = [...objectives];
        updated[index] = value;
        setObjectives(updated);
        clearError('objectives');
    }

    function addObjective() {
        setObjectives([...objectives, '']);
    }

    function removeObjective(index) {
        setObjectives(objectives.filter((_, i) => i !== index));
    }

    function validate() {
        const next = {};
        if (!title.trim()) next.title = 'Title is required';
        if (!description.trim()) next.description = 'Description is required';
        if (objectives.filter((o) => o.trim() !== '').length === 0)
            next.objectives = 'At least one objective is required';
        if (!timeLimit || Number(timeLimit) <= 0) next.timeLimit = 'Time limit is required';
        if (!rewardCoins || Number(rewardCoins) <= 0) {
            next.rewardCoins = 'Reward coins is required';
        } else if (Number(rewardCoins) > 20) {
            next.rewardCoins = 'Maximum reward is 20 coins';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    function handleSubmit() {
        if (!validate()) return;
        onSubmit({
            title: title.trim(),
            instructions: description.trim(),
            objectives: objectives.filter((o) => o.trim() !== ''),
            timeLimit: Number(timeLimit),
            rewardCoins: Number(rewardCoins),
        });
    }

    function clearError(field) {
        setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }

    return (
        <div className="form-overlay" onClick={onClose}>
            <div className="form-container" onClick={(e) => e.stopPropagation()}>

                <div className="form-header">
                    <h2 className="form-title">Edit System Task</h2>
                    <button className="form-close" onClick={onClose}>✕</button>
                </div>

                <div className="form-body">
                    <div className="form-field">
                        <label className="form-label">Title</label>
                        <input
                            type="text"
                            className={'form-input' + (errors.title ? ' form-input--error' : '')}
                            placeholder="Task title..."
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); clearError('title'); }}
                        />
                        {errors.title && <p className="form-error">{errors.title}</p>}
                    </div>

                    <div className="form-field">
                        <label className="form-label">Description</label>
                        <textarea
                            className={'form-input form-textarea' + (errors.description ? ' form-input--error' : '')}
                            placeholder="Describe the task objectives and requirements..."
                            rows={3}
                            value={description}
                            onChange={(e) => { setDescription(e.target.value); clearError('description'); }}
                        />
                        {errors.description && <p className="form-error">{errors.description}</p>}
                    </div>

                    <div className="form-field">
                        <label className="form-label">Objectives</label>
                        {objectives.map((obj, index) => (
                            <div key={index} className="form-objective-row">
                                <input
                                    type="text"
                                    className={'form-input' + (errors.objectives ? ' form-input--error' : '')}
                                    placeholder={`Objective ${index + 1}...`}
                                    value={obj}
                                    onChange={(e) => handleObjectiveChange(index, e.target.value)}
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
                            type="number"
                            className={'form-input form-input--short' + (errors.timeLimit ? ' form-input--error' : '')}
                            placeholder="e.g. 2"
                            min="1"
                            value={timeLimit}
                            onChange={(e) => { setTimeLimit(e.target.value); clearError('timeLimit'); }}
                        />
                        {errors.timeLimit && <p className="form-error">{errors.timeLimit}</p>}
                    </div>

                    <div className="form-field">
                        <label className="form-label">Reward Coins</label>
                        <input
                            type="number"
                            className={'form-input form-input--short' + (errors.rewardCoins ? ' form-input--error' : '')}
                            placeholder="e.g. 10"
                            min="1"
                            max="20"
                            value={rewardCoins}
                            onChange={(e) => { setRewardCoins(e.target.value); clearError('rewardCoins'); }}
                        />
                        {errors.rewardCoins && <p className="form-error">{errors.rewardCoins}</p>}
                        <p className="form-reward-note">* Reward is kept small (max 20 coins) to maintain economy balance.</p>
                    </div>
                </div>

                <div className="form-footer">
                    {submitError && <p className="form-error">{submitError}</p>}
                    <button className="form-btn form-btn--cancel" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button className="form-btn form-btn--submit" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

            </div>
        </div>
    );
}
