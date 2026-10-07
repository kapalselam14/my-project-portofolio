import { useRef, useState } from 'react';
import { useNotifTemplates } from '../../hooks/useNotifTemplates';
import { useToast } from '../../context/ToastContext';
import { PageSkeleton, PageError, EmptyState, EmptyIcons } from '../../components/ui/PageStates';
import type { NotifTemplate, TemplateCategory, TemplateTrigger } from '../../types/templates';

// Known unfired triggers: the backend dispatcher only fires a subset of triggers.
// eslint-disable-next-line react-refresh/only-export-components
export const UNFIRED_TRIGGERS: TemplateTrigger[] = [
  'activity.reminder',
  'activity.starting_soon',
  'engagement.inactive',
  'engagement.new_activity_nearby',
];

// Category badge.

function CategoryBadge({ category }: { category: TemplateCategory }) {
  const map: Record<TemplateCategory, string> = {
    Activity: 'badge-blue',
    Account: 'badge-neutral',
    Moderation: 'badge-red',
    Engagement: 'badge-green',
  };
  return <span className={map[category]}>{category}</span>;
}

// Toggle.

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 ${
        checked ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

// Variable chip.

function VarChip({ variable, onClick }: { variable: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Insert {{${variable}}}`}
      className="rounded-md bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 px-2 py-0.5 font-mono text-[11px] text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
    >
      {`{{${variable}}}`}
    </button>
  );
}

// Phone preview.

function PhonePreview({ title, body }: { title: string; body: string }) {
  // Replace {{variable}} with sample values for preview
  const sampleValues: Record<string, string> = {
    participantName: 'Alex M.',
    activityName: 'Sunday Basketball',
    participantCount: '6',
    capacity: '10',
    activityDate: 'Nov 3',
    activityTime: '10:00 AM',
    location: 'City Gym',
    hostName: 'Coach Dave',
    userName: 'Jordan',
    reason: 'Community guideline violation',
    supportEmail: 'support@matchup.app',
    appealDeadline: 'Nov 10',
    adminNote: 'Your record has been restored.',
    nearbyCount: '5',
    sport: 'Futsal',
    distanceKm: '2.3',
    spotsLeft: '3',
  };

  function render(text: string) {
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => sampleValues[k] ?? `[${k}]`);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Preview</p>
      <div className="w-52 rounded-[2.2rem] border-[6px] border-ink-800 dark:border-ink-600 bg-ink-800 dark:bg-ink-600 shadow-xl">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-20 -translate-x-1/2 rounded-b-2xl bg-ink-800 dark:bg-ink-600 hidden" />
        <div className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 min-h-[260px] pb-6 pt-5">
          <div className="flex items-center justify-between px-4 pb-2 text-[9px] font-semibold text-ink-500 dark:text-ink-400">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor">
                <rect x="0" y="4" width="2" height="4" rx="0.5" />
                <rect x="3" y="2.5" width="2" height="5.5" rx="0.5" />
                <rect x="6" y="1" width="2" height="7" rx="0.5" />
              </svg>
              <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor">
                <rect
                  x="0.5"
                  y="0.5"
                  width="11"
                  height="7"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1"
                  fill="none"
                />
                <rect x="12" y="2" width="1.5" height="4" rx="0.75" />
                <rect x="1.5" y="1.5" width="7" height="5" rx="1.2" />
              </svg>
            </div>
          </div>
          <div className="mx-3 rounded-2xl bg-white dark:bg-ink-800 px-3.5 py-3 shadow-sm border border-ink-100 dark:border-ink-700">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold shadow">
                M
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">
                    MatchUp
                  </p>
                  <p className="text-[9px] text-ink-400">now</p>
                </div>
                <p className="mt-0.5 text-[11px] font-bold text-ink-900 dark:text-ink-100 leading-tight">
                  {render(title) || 'Notification title'}
                </p>
                <p className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400 leading-snug line-clamp-3">
                  {render(body) || 'Message body will appear here…'}
                </p>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-5 h-1 w-20 rounded-full bg-ink-300 dark:bg-ink-600" />
        </div>
      </div>
    </div>
  );
}

// Template editor drawer.

function EditDrawer({
  template,
  onSave,
  onCancel,
}: {
  template: NotifTemplate;
  onSave: (patch: Partial<NotifTemplate>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function insertAtCursor(
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    value: string,
    setValue: (v: string) => void,
    token: string,
  ) {
    const el = ref.current;
    if (!el || typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number') {
      setValue(value + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + token + value.slice(end);
    setValue(next);
    // Restore caret after the inserted token.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function insertVar(variable: string, target: 'title' | 'body') {
    const token = `{{${variable}}}`;
    if (target === 'title') insertAtCursor(titleRef, title, setTitle, token);
    else insertAtCursor(bodyRef, body, setBody, token);
  }

  function handleSave() {
    onSave({ title: title.trim(), body: body.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/60 px-0 sm:px-4">
      <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-ink-800 shadow-panel max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-700 px-6 py-4 sticky top-0 bg-white dark:bg-ink-800 z-10">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Edit Template</h2>
            <p className="text-xs text-ink-500 mt-0.5">{template.name}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-ink-400 hover:text-ink-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-ink-100 dark:divide-ink-700">
          {/* Edit form */}
          <div className="p-6 space-y-4">
            {/* Variable chips */}
            {template.variables.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-500">
                  Available variables — click to insert
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {template.variables.map((v) => (
                    <VarChip key={v} variable={v} onClick={() => insertVar(v, 'body')} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-600">
                Title
                <span className="ml-1.5 text-[10px] font-normal text-ink-400">
                  (shown as notification heading)
                </span>
              </label>
              <input
                ref={(el) => {
                  titleRef.current = el;
                }}
                className="input text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
              />
              <p className="mt-0.5 text-right text-[10px] text-ink-400">{title.length}/80</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-600">
                Body
                <span className="ml-1.5 text-[10px] font-normal text-ink-400">
                  (notification message text)
                </span>
              </label>
              <textarea
                ref={(el) => {
                  bodyRef.current = el;
                }}
                className="input min-h-[120px] resize-none text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={300}
              />
              <p className="mt-0.5 text-right text-[10px] text-ink-400">{body.length}/300</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} className="btn-primary flex-1 rounded-xl py-2.5 text-sm">
                Save Template
              </button>
              <button onClick={onCancel} className="btn-outline rounded-xl px-5 py-2.5 text-sm">
                Cancel
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center justify-center p-6">
            <PhonePreview title={title} body={body} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Template row.

function TemplateRow({
  template,
  onEdit,
  onToggle,
}: {
  template: NotifTemplate;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-4 px-4 sm:px-6 py-4 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/50 ${
        !template.enabled ? 'opacity-60' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <Toggle checked={template.enabled} onChange={onToggle} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink-900">{template.name}</p>
          <CategoryBadge category={template.category} />
          {UNFIRED_TRIGGERS.includes(template.trigger) && (
            <span
              className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-semibold text-warning-700"
              title={`Trigger "${template.trigger}" has no sender yet`}
            >
              Inactive trigger
            </span>
          )}
          {!template.enabled && (
            <span className="rounded-full bg-ink-100 dark:bg-ink-700 px-2 py-0.5 text-[10px] font-semibold text-ink-400">
              Disabled
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-500">{template.description}</p>
        <div className="mt-1.5 space-y-0.5">
          <p className="text-xs text-ink-600 dark:text-ink-400 truncate">
            <span className="font-semibold text-ink-700 dark:text-ink-300">Title: </span>
            {template.title}
          </p>
          <p className="text-xs text-ink-400 line-clamp-2">
            <span className="font-semibold text-ink-500">Body: </span>
            {template.body}
          </p>
        </div>
        {template.variables.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {template.variables.map((v) => (
              <span
                key={v}
                className="rounded bg-ink-100 dark:bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 dark:text-ink-400"
              >
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="hidden sm:block text-[10px] text-ink-400">
          Edited{' '}
          {new Date(template.lastEditedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </p>
        <button onClick={onEdit} className="btn-outline btn-sm">
          Edit
        </button>
      </div>
    </div>
  );
}

// Page.

const ALL_CATEGORIES: Array<TemplateCategory | 'All'> = [
  'All',
  'Activity',
  'Account',
  'Moderation',
  'Engagement',
];

export function NotificationTemplatesPage() {
  const { loading, error, templates, handleUpdate, handleToggle, reload } = useNotifTemplates();
  const { push: toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');
  const [editingTemplate, setEditingTemplate] = useState<NotifTemplate | null>(null);
  const [search, setSearch] = useState('');

  if (loading) return <PageSkeleton rows={4} />;
  if (error) return <PageError message={error} onRetry={reload} />;

  async function handleSave(patch: Partial<NotifTemplate>) {
    if (!editingTemplate) return;
    try {
      await handleUpdate(editingTemplate.id, patch);
      toast(`"${editingTemplate.name}" template updated.`, 'success');
      setEditingTemplate(null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  async function onToggle(template: NotifTemplate) {
    try {
      await handleToggle(template.id);
      toast(
        `"${template.name}" ${template.enabled ? 'disabled' : 'enabled'}.`,
        template.enabled ? 'info' : 'success',
      );
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  const filtered = templates.filter((t) => {
    const matchCat = activeCategory === 'All' || t.category === activeCategory;
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.trigger.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const enabledCount = templates.filter((t) => t.enabled).length;
  const disabledCount = templates.filter((t) => !t.enabled).length;

  return (
    <div className="page-container space-y-5">
      {editingTemplate && (
        <EditDrawer
          template={editingTemplate}
          onSave={handleSave}
          onCancel={() => setEditingTemplate(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Notification Templates</h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Manage automated push notification content sent to mobile app users
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Templates', value: templates.length, color: 'text-ink-900' },
          { label: 'Enabled', value: enabledCount, color: 'text-success-600' },
          { label: 'Disabled', value: disabledCount, color: 'text-ink-400' },
          { label: 'Categories', value: 4, color: 'text-brand-500' },
        ].map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-4 py-3 text-sm text-brand-700 dark:text-brand-300">
        <span className="font-semibold">Note: </span>
        Template changes take effect on the next notification send. Variables in{' '}
        <code className="rounded bg-brand-100 dark:bg-brand-800/50 px-1 font-mono text-xs">
          {'{{double braces}}'}
        </code>{' '}
        are replaced automatically by the backend with real user/activity data.
      </div>

      {/* Main panel */}
      <div className="panel overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-ink-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-1">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeCategory === cat
                    ? 'bg-brand-500 text-white'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-300 dark:hover:bg-ink-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-ink-50 dark:bg-ink-700/50 px-3 py-1.5 w-full sm:w-auto">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <circle cx="6" cy="6" r="4" />
              <path d="M11 11l-2.5-2.5" />
            </svg>
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-ink-700 dark:text-ink-300 placeholder:text-ink-400 focus:outline-none sm:w-44"
            />
          </div>
        </div>

        {/* Template list */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={EmptyIcons.broadcasts}
            title="No templates found."
            description={search ? 'Try a different search term.' : undefined}
          />
        ) : (
          <div className="divide-y divide-ink-100 dark:divide-ink-700">
            {filtered.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                onEdit={() => setEditingTemplate(t)}
                onToggle={() => onToggle(t)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
