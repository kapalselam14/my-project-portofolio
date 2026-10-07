import { useState } from 'react';
import type { SportConfig } from '../../../types/sports';
import { EmojiPicker } from './SportEmoji';

// Dialog for adding a sport to the catalogue.

// Add-sport dialog.
export function AddSportModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (sport: SportConfig) => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏅');
  const [error, setError] = useState('');

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    onAdd({
      id: trimmed.toLowerCase().replace(/\s+/g, '_'),
      name: trimmed,
      emoji,
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 999,
      activityCount: 0,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">Add Sport</h2>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-600">Sport Name</label>
            <input
              className="input"
              placeholder="e.g. Handball"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-600">
              Icon <span className="ml-1 text-xl">{emoji}</span>
            </label>
            <EmojiPicker selected={emoji} onSelect={setEmoji} />
          </div>
          {error && <p className="text-xs text-danger-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} className="btn-primary flex-1 rounded-xl py-2.5 text-sm">
              Add Sport
            </button>
            <button onClick={onClose} className="btn-outline flex-1 rounded-xl py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
