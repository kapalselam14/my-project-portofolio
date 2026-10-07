import { useState } from 'react';
import type { SportConfig } from '../../../types/sports';
import { Toggle, SurfaceChip } from './SportControls';

// Draggable sport row with flag toggles.

// Sport row.
export function SportRow({
  sport,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  sport: SportConfig;
  onUpdate: (id: string, patch: Partial<SportConfig>) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-ink-50 transition-colors"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(sport.id);
        }}
        onDragOver={onDragOver}
        onDrop={() => onDrop(sport.id)}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Drag handle */}
        <td
          className="tbl-td w-8 cursor-grab text-ink-300 active:cursor-grabbing select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="10" cy="3" r="1.2" />
            <circle cx="4" cy="7" r="1.2" />
            <circle cx="10" cy="7" r="1.2" />
            <circle cx="4" cy="11" r="1.2" />
            <circle cx="10" cy="11" r="1.2" />
          </svg>
        </td>

        {/* Emoji + Name */}
        <td className="tbl-td">
          <div className="flex items-center gap-3">
            <span className="text-xl">{sport.emoji}</span>
            <div>
              <p
                className={`font-semibold ${sport.enabled ? 'text-ink-900' : 'text-ink-400 line-through'}`}
              >
                {sport.name}
              </p>
              {/* Surface chips — compact summary */}
              <div className="mt-0.5 flex gap-1">
                <SurfaceChip
                  label="Filter"
                  active={sport.enabled && sport.showInFilter}
                  tooltip="Discovery filter"
                />
                <SurfaceChip
                  label="Onboarding"
                  active={sport.enabled && sport.showInOnboarding}
                  tooltip="Sport picker in onboarding"
                />
                <SurfaceChip
                  label="Host"
                  active={sport.enabled && sport.canHost}
                  tooltip="Users can create activities"
                />
              </div>
            </div>
          </div>
        </td>

        {/* Activity count */}
        <td className="tbl-td text-[13px] text-ink-600">{sport.activityCount.toLocaleString()}</td>

        {/* Single enabled toggle */}
        <td className="tbl-td" onClick={(e) => e.stopPropagation()}>
          <Toggle
            checked={sport.enabled}
            onChange={(v) => onUpdate(sport.id, { enabled: v })}
            size="md"
          />
        </td>

        {/* Expand chevron + delete */}
        <td className="tbl-td">
          <div className="flex items-center justify-end gap-2">
            {sport.activityCount === 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(sport.id);
                }}
                className="rounded-lg p-1.5 text-danger-400 hover:bg-danger-50 hover:text-danger-600 transition-colors"
                title="Remove"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="M2 3.5h10M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M6 6.5v3M8 6.5v3M3 3.5l.7 7.5a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-7.5" />
                </svg>
              </button>
            ) : (
              <span className="w-[30px]" />
            )}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              className={`text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="M3 5l4 4 4-4" />
            </svg>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-ink-50">
          <td colSpan={5} className="px-6 py-3">
            <div className="flex flex-wrap items-center gap-6">
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
                Where to show:
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700 select-none">
                <Toggle
                  checked={sport.showInFilter && sport.enabled}
                  onChange={(v) => onUpdate(sport.id, { showInFilter: v })}
                />
                Discovery filter
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700 select-none">
                <Toggle
                  checked={sport.showInOnboarding && sport.enabled}
                  onChange={(v) => onUpdate(sport.id, { showInOnboarding: v })}
                />
                Onboarding picker
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700 select-none">
                <Toggle
                  checked={sport.canHost && sport.enabled}
                  onChange={(v) => onUpdate(sport.id, { canHost: v })}
                />
                Users can host
              </label>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
