import { useState } from 'react';
import { useBroadcasts } from '../../hooks/useBroadcasts';
import {
  BroadcastsPageSkeleton,
  PageError,
  EmptyState,
  EmptyIcons,
} from '../../components/ui/PageStates';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { BroadcastStatus, BroadcastAudience } from '../../types/broadcasts';

// Status badge.

function StatusBadge({ status }: { status: BroadcastStatus }) {
  const map: Record<BroadcastStatus, string> = {
    Sent: 'badge-green',
    Scheduled: 'badge-blue',
    Draft: 'badge-neutral',
  };
  return <span className={map[status]}>{status}</span>;
}

// Phone notification preview.

function PhonePreview({
  title,
  message,
  audience,
}: {
  title: string;
  message: string;
  audience: BroadcastAudience;
}) {
  const hasContent = title.trim() || message.trim();

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone shell */}
      <div className="relative w-52 rounded-[2.4rem] border-[6px] border-ink-800 dark:border-ink-600 bg-ink-800 dark:bg-ink-600 shadow-xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-5 w-20 -translate-x-1/2 rounded-b-2xl bg-ink-800 dark:bg-ink-600" />
        {/* Screen */}
        <div className="overflow-hidden rounded-[1.8rem] bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 min-h-[320px] pb-4 pt-6">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pb-2 pt-1 text-[9px] font-semibold text-ink-600 dark:text-ink-400">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="currentColor">
                <rect x="0" y="4" width="2" height="4" rx="0.5" />
                <rect x="3" y="2.5" width="2" height="5.5" rx="0.5" />
                <rect x="6" y="1" width="2" height="7" rx="0.5" />
              </svg>
              <svg width="9" height="8" viewBox="0 0 9 8" fill="currentColor">
                <path
                  d="M4.5 1.5C6.2 1.5 7.7 2.3 8.6 3.5l-1.1.9A3.8 3.8 0 004.5 3C3.3 3 2.2 3.5 1.4 4.4L.3 3.5C1.3 2.3 2.8 1.5 4.5 1.5z"
                  opacity=".5"
                />
                <path d="M4.5 3.8A2.2 2.2 0 016.3 4.7l-1 .8A.9.9 0 004.5 5a.9.9 0 00-.8.5l-1-.8A2.2 2.2 0 014.5 3.8z" />
                <circle cx="4.5" cy="6.5" r="1" />
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

          {/* Notification card */}
          {hasContent ? (
            <div className="mx-3 rounded-2xl bg-white dark:bg-ink-800 px-3.5 py-3 shadow-sm border border-ink-100 dark:border-ink-700">
              <div className="flex items-start gap-2.5">
                {/* App icon */}
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold shadow">
                  M
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-[10px] font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">
                      MatchUp
                    </p>
                    <p className="text-[9px] text-ink-400 shrink-0">now</p>
                  </div>
                  <p className="mt-0.5 text-[11px] font-bold text-ink-900 dark:text-ink-100 leading-tight truncate">
                    {title || 'Notification title'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400 leading-snug line-clamp-2">
                    {message || 'Your message will appear here…'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-3 rounded-2xl border border-dashed border-ink-300 dark:border-ink-600 px-4 py-5 text-center">
              <p className="text-[10px] text-ink-400">Start typing to preview the notification</p>
            </div>
          )}

          {/* Home indicator */}
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-ink-300 dark:bg-ink-600" />
        </div>
      </div>

      {/* Audience label */}
      <div className="text-center">
        <p className="text-xs font-semibold text-ink-500">Audience</p>
        <span className="mt-0.5 inline-block rounded-full bg-brand-100 dark:bg-brand-900/40 px-3 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
          {audience}
        </span>
      </div>
    </div>
  );
}

// Audience options.

const AUDIENCE_OPTIONS: BroadcastAudience[] = [
  'All Users',
  'Hosts Only',
  'Players Only',
  'Inactive Users',
];

// Page.

export function BroadcastsPage() {
  const {
    loading,
    error,
    broadcasts,
    reload,
    handleCreate,
    handleDelete,
    handleSend: sendDraft,
    handleUpdate,
  } = useBroadcasts();
  const { push: toast } = useToast();
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    audience: 'All Users' as BroadcastAudience,
    scheduledAt: '',
  });
  const [activeTab, setActiveTab] = useState<BroadcastStatus | 'All'>('All');
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [confirm, setConfirm] = useState<{
    type: 'send' | 'delete';
    id: string;
    title: string;
  } | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    message: string;
    audience: BroadcastAudience;
    scheduledAt: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  if (loading) return <BroadcastsPageSkeleton />;
  if (error) return <PageError message={error} onRetry={reload} />;

  const filtered = broadcasts.filter((b) => activeTab === 'All' || b.status === activeTab);

  async function handleSend() {
    if (!form.title.trim() || !form.message.trim()) {
      toast('Title and message are required.', 'error');
      return;
    }
    setSending(true);
    try {
      await handleCreate({ title: form.title, message: form.message, audience: form.audience });
      toast(`Broadcast sent to ${form.audience}.`, 'success');
      setForm({ title: '', message: '', audience: 'All Users', scheduledAt: '' });
      setShowCompose(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Send failed.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleSchedule() {
    if (!form.title.trim() || !form.message.trim()) {
      toast('Title and message are required.', 'error');
      return;
    }
    if (!form.scheduledAt) {
      toast('Pick a scheduled date and time.', 'error');
      return;
    }
    const when = new Date(form.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast('Scheduled time must be in the future.', 'error');
      return;
    }
    setScheduling(true);
    try {
      await handleCreate({
        title: form.title,
        message: form.message,
        audience: form.audience,
        scheduledAt: when.toISOString(),
      });
      toast(`Broadcast scheduled for ${when.toLocaleString()}.`, 'success');
      setForm({ title: '', message: '', audience: 'All Users', scheduledAt: '' });
      setShowCompose(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Schedule failed.', 'error');
    } finally {
      setScheduling(false);
    }
  }

  async function handleSendDraft(id: string) {
    await sendDraft(id);
    toast('Draft sent successfully.', 'success');
  }

  async function handleDeleteBroadcast(id: string) {
    await handleDelete(id);
    toast('Broadcast deleted.', 'info');
  }

  const TABS: Array<BroadcastStatus | 'All'> = ['All', 'Sent', 'Scheduled', 'Draft'];

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-100 sm:text-2xl">
            Broadcasts
          </h1>
          <p className="mt-1 text-xs text-ink-600 dark:text-ink-400 sm:text-sm">
            Send announcements and targeted messages to platform users
          </p>
        </div>
        <button
          onClick={() => setShowCompose((v) => !v)}
          className={`rounded-lg px-4 py-2 text-sm self-start sm:self-auto transition-colors ${showCompose ? 'btn-outline' : 'btn-primary'}`}
        >
          {showCompose ? 'Cancel' : '+ New Broadcast'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Sent', value: broadcasts.filter((b) => b.status === 'Sent').length },
          { label: 'Scheduled', value: broadcasts.filter((b) => b.status === 'Scheduled').length },
          { label: 'Draft', value: broadcasts.filter((b) => b.status === 'Draft').length },
        ].map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className="text-2xl font-bold text-ink-900 dark:text-ink-100">{s.value}</p>
            <p className="mt-1 text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Compose panel with phone preview */}
      {showCompose && (
        <div className="panel border-2 border-brand-200 dark:border-brand-700 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
              Compose Broadcast
            </h2>
            <button
              onClick={() => setShowCompose(false)}
              className="text-ink-400 hover:text-ink-700 text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_220px]">
            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Title
                </label>
                <input
                  className="input"
                  placeholder="e.g. New Feature Announcement"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={80}
                />
                <p className="mt-0.5 text-right text-[10px] text-ink-400">{form.title.length}/80</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Message
                </label>
                <textarea
                  className="input min-h-[100px] resize-none"
                  placeholder="Write your broadcast message…"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  maxLength={200}
                />
                <p className="mt-0.5 text-right text-[10px] text-ink-400">
                  {form.message.length}/200
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Audience
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, audience: aud }))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                        form.audience === aud
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-700'
                      }`}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Schedule for later (optional)
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleSend}
                  disabled={sending || scheduling}
                  className="btn-primary rounded-xl px-5 py-2 text-sm disabled:opacity-50"
                >
                  {sending ? 'Sending…' : 'Send Now'}
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={sending || scheduling}
                  className="btn-outline rounded-xl px-5 py-2 text-sm disabled:opacity-50"
                >
                  {scheduling ? 'Scheduling…' : 'Schedule'}
                </button>
                <button
                  onClick={() => setShowCompose(false)}
                  className="btn-outline rounded-xl px-5 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Phone preview */}
            <div className="flex flex-col items-center gap-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Preview
              </p>
              <PhonePreview title={form.title} message={form.message} audience={form.audience} />
            </div>
          </div>
        </div>
      )}

      {/* History panel */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-200 dark:border-ink-700 px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
            Broadcast History
          </h2>
          <div className="flex flex-wrap gap-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-brand-500 text-white'
                    : 'bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={EmptyIcons.broadcasts}
            title={
              activeTab === 'All'
                ? 'No broadcasts yet.'
                : `No ${activeTab.toLowerCase()} broadcasts.`
            }
            description={
              activeTab === 'All' ? 'Send your first broadcast to platform users.' : undefined
            }
            action={
              activeTab === 'All'
                ? { label: '+ New Broadcast', onClick: () => setShowCompose(true) }
                : undefined
            }
          />
        ) : (
          <div className="divide-y divide-ink-200 dark:divide-ink-700">
            {filtered.map((b) => (
              <div key={b.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900 dark:text-ink-100">{b.title}</p>
                      <StatusBadge status={b.status} />
                      <span className="rounded-full bg-ink-100 dark:bg-ink-700 px-2 py-0.5 text-[11px] font-medium text-ink-500 dark:text-ink-400">
                        {b.audience}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-600 dark:text-ink-400 line-clamp-2">
                      {b.message}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-400">
                      {b.sentAt && <span>Sent: {b.sentAt}</span>}
                      {b.scheduledAt && <span>Scheduled: {b.scheduledAt}</span>}
                      {b.recipients > 0 && <span>{b.recipients.toLocaleString()} recipients</span>}
                      {b.openRate && (
                        <span className="font-semibold text-brand-500">
                          {b.openRate}% open rate
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(b.status === 'Draft' || b.status === 'Scheduled') && (
                      <button
                        onClick={() =>
                          setEditing({
                            id: b.id,
                            title: b.title,
                            message: b.message,
                            audience: b.audience,
                            scheduledAt: b.scheduledAt ?? '',
                          })
                        }
                        className="btn-outline btn-sm"
                      >
                        Edit
                      </button>
                    )}
                    {b.status === 'Draft' && (
                      <button
                        onClick={() => setConfirm({ type: 'send', id: b.id, title: b.title })}
                        className="btn-primary btn-sm"
                      >
                        Send
                      </button>
                    )}
                    <button
                      onClick={() => setConfirm({ type: 'delete', id: b.id, title: b.title })}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 hover:text-danger-600 transition-colors"
                      title="Delete"
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'send' ? `Send "${confirm?.title}"?` : `Delete "${confirm?.title}"?`
        }
        description={
          confirm?.type === 'send'
            ? 'This draft will be sent to its selected audience immediately.'
            : 'This action cannot be undone. The broadcast will be permanently removed.'
        }
        confirmLabel={confirm?.type === 'send' ? 'Send' : 'Delete'}
        destructive={confirm?.type === 'delete'}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            if (confirm.type === 'send') {
              await handleSendDraft(confirm.id);
            } else {
              await handleDeleteBroadcast(confirm.id);
            }
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Action failed.', 'error');
          }
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-ink-800 p-6 shadow-panel">
            <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
              Edit Broadcast
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Title
                </label>
                <input
                  className="input"
                  value={editing.title}
                  onChange={(e) => setEditing((v) => v && { ...v, title: e.target.value })}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Message
                </label>
                <textarea
                  className="input min-h-[100px] resize-none"
                  value={editing.message}
                  onChange={(e) => setEditing((v) => v && { ...v, message: e.target.value })}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Audience
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setEditing((v) => v && { ...v, audience: aud })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                        editing.audience === aud
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-600'
                      }`}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-600 dark:text-ink-400">
                  Scheduled at (optional)
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  value={editing.scheduledAt}
                  onChange={(e) => setEditing((v) => v && { ...v, scheduledAt: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  disabled={editSaving}
                  onClick={async () => {
                    if (!editing.title.trim() || !editing.message.trim()) {
                      toast('Title and message are required.', 'error');
                      return;
                    }
                    setEditSaving(true);
                    try {
                      await handleUpdate(editing.id, {
                        title: editing.title,
                        message: editing.message,
                        audience: editing.audience,
                        scheduledAt: editing.scheduledAt
                          ? new Date(editing.scheduledAt).toISOString()
                          : null,
                      });
                      toast('Broadcast updated.', 'success');
                      setEditing(null);
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
                    } finally {
                      setEditSaving(false);
                    }
                  }}
                  className="btn-primary rounded-xl px-5 py-2 text-sm disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="btn-outline rounded-xl px-5 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
