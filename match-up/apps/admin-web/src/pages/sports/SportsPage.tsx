// Flag toggles save immediately. Structural edits stay staged until publish.
const FLAG_FIELDS = ['enabled', 'showInFilter', 'showInOnboarding', 'canHost'] as const;

import { useEffect, useState, useRef } from 'react';
import { fetchSports, replaceSports, updateSport } from '../../services/sportsService';
import { downloadCsv } from '../../utils/csvExport';
import { useToast } from '../../context/ToastContext';
import { SportsPageSkeleton, PageError } from '../../components/ui/PageStates';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { SportConfig } from '../../types/sports';
import { AddSportModal } from './components/AddSportModal';
import { Toggle, SurfaceChip } from './components/SportControls';
import { SportRow } from './components/SportRow';
import { SummaryCard, MobilePreview } from './components/SportPreview';

export function SportsPage() {
  const [sports, setSports] = useState<SportConfig[]>([]);
  const [baseline, setBaseline] = useState<SportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SportConfig | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const dragId = useRef<string | null>(null);
  const { push: toast } = useToast();

  // Staged structural edits (add/remove/reorder) differ from the last saved baseline.
  const dirty =
    sports.length !== baseline.length ||
    sports.some((s) => {
      const b = baseline.find((x) => x.id === s.id);
      return (
        !b ||
        b.name !== s.name ||
        b.emoji !== s.emoji ||
        b.enabled !== s.enabled ||
        b.showInFilter !== s.showInFilter ||
        b.showInOnboarding !== s.showInOnboarding ||
        b.canHost !== s.canHost ||
        b.sortOrder !== s.sortOrder
      );
    });

  // Database is the source of truth — no local defaults.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSports()
      .then((rows) => {
        if (!cancelled) {
          setSports(rows);
          setBaseline(rows);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load sports.';
          setLoadError(message);
          toast(message, 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const rows = await fetchSports();
      setSports(rows);
      setBaseline(rows);
      setLoadError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sports.';
      setLoadError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Flag toggles persist immediately via PATCH with rollback on error.
  async function update(id: string, patch: Partial<SportConfig>) {
    const onlyFlags = Object.keys(patch).every((k) =>
      (FLAG_FIELDS as readonly string[]).includes(k),
    );
    if (!onlyFlags) {
      setSports((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      return;
    }
    const prevRow = sports.find((s) => s.id === id);
    if (!prevRow) return;
    const nextRow = { ...prevRow, ...patch };
    setSports((prev) => prev.map((s) => (s.id === id ? nextRow : s)));
    try {
      const saved = await updateSport(id, patch);
      // Sync baseline flags so a successful toggle never shows as unsaved.
      setBaseline((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                enabled: saved.enabled,
                showInFilter: saved.showInFilter,
                showInOnboarding: saved.showInOnboarding,
                canHost: saved.canHost,
                activityCount: saved.activityCount,
              }
            : s,
        ),
      );
    } catch (err: unknown) {
      setSports((prev) => prev.map((s) => (s.id === id ? prevRow : s)));
      toast(err instanceof Error ? err.message : 'Failed to update sport.', 'error');
    }
  }

  function handleDelete(id: string) {
    const sport = sports.find((s) => s.id === id);
    if (sport) setPendingDelete(sport);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setSports((prev) => prev.filter((s) => s.id !== id));
    // Keep the baseline row so Reload (after confirm) can still restore it.
    toast(`"${name}" will be removed when you publish.`, 'info');
    setPendingDelete(null);
  }

  function handleAdd(sport: SportConfig) {
    setSports((prev) => {
      const maxOrder = Math.max(...prev.map((s) => s.sortOrder), 0);
      return [...prev, { ...sport, sortOrder: maxOrder + 1 }];
    });
    toast(`"${sport.name}" staged — Publish to save.`, 'success');
  }

  async function handleSave() {
    // Normalise sort orders to 1-based sequential
    const sorted = [...sports]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s, i) => ({ ...s, sortOrder: i + 1 }));
    setSaving(true);
    try {
      const published = await replaceSports(sorted);
      setSports(published);
      setBaseline(published);
      toast('Changes published.', 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to publish.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    // Never silently discard staged edits — confirm first when dirty.
    if (dirty) {
      setShowResetConfirm(true);
      return;
    }
    void reload();
    toast('Reloaded from database.', 'info');
  }

  function confirmReset() {
    setShowResetConfirm(false);
    void reload();
    toast('Unsaved changes discarded.', 'info');
  }

  function handleExport() {
    downloadCsv(
      sports.map((s) => ({
        ID: s.id,
        Name: s.name,
        Enabled: s.enabled,
        Filter: s.showInFilter,
        Onboarding: s.showInOnboarding,
        CanHost: s.canHost,
        Activities: s.activityCount,
      })),
      'matchup-sports.csv',
    );
    toast('Sports exported as CSV.', 'info');
  }

  // Drag reorder (staged until Publish — no per-row reorder endpoint)
  function onDragStart(id: string) {
    dragId.current = id;
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(targetId: string) {
    if (!dragId.current || dragId.current === targetId) return;
    setSports((prev) => {
      const from = prev.findIndex((s) => s.id === dragId.current);
      const to = prev.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      if (!item) return prev;
      arr.splice(to, 0, item);
      return arr.map((s, i) => ({ ...s, sortOrder: i + 1 }));
    });
    dragId.current = null;
  }

  const filtered = sports.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search.toLowerCase()),
  );

  const enabledCount = sports.filter((s) => s.enabled).length;
  const filterCount = sports.filter((s) => s.enabled && s.showInFilter).length;
  const onboardingCount = sports.filter((s) => s.enabled && s.showInOnboarding).length;

  if (loading) {
    return <SportsPageSkeleton />;
  }

  if (loadError) {
    return <PageError message={loadError} onRetry={() => void reload()} />;
  }

  return (
    <div className="page-container space-y-5">
      {showAdd && <AddSportModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Remove "${pendingDelete.name}"?` : 'Remove sport?'}
        description="This stages the removal. The sport is permanently deleted only when you Publish Changes."
        confirmLabel="Stage removal"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Discard unsaved changes?"
        description="Your staged adds, removals, and reorders will be lost and the list reloaded from the database."
        confirmLabel="Discard & reload"
        destructive
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Sports Management</h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Configure which sports appear in onboarding, discovery filter, and activity creation on
            the mobile app
          </p>
          {dirty && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-0.5 text-[11px] font-semibold text-warning-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning-500" />
              Unsaved changes — Publish to save
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="btn-outline rounded-lg px-3 py-1.5 text-sm">
            Export CSV
          </button>
          <button
            onClick={handleReset}
            className="btn-outline rounded-lg px-3 py-1.5 text-sm text-danger-600 border-danger-200 hover:bg-danger-50"
          >
            Reload
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-outline rounded-lg px-3 py-1.5 text-sm"
          >
            + Add Sport
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary rounded-lg px-4 py-1.5 text-sm disabled:opacity-60"
          >
            {saving ? 'Publishing…' : 'Publish Changes'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Sports" value={sports.length} />
        <SummaryCard label="Enabled" value={enabledCount} color="text-brand-500" />
        <SummaryCard
          label="In Filter"
          value={filterCount}
          color="text-brand-400"
          sub="Discovery screen"
        />
        <SummaryCard
          label="In Onboarding"
          value={onboardingCount}
          color="text-brand-400"
          sub="Setup flow"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        {/* Table */}
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3.5 sm:px-6">
            <p className="text-sm font-semibold text-ink-900">
              Sport Catalogue{' '}
              <span className="ml-1.5 text-xs font-normal text-ink-400">drag rows to reorder</span>
            </p>
            <div className="flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1.5">
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <circle cx="5.5" cy="5.5" r="3.8" />
                <path d="M10 10l-2-2" />
              </svg>
              <input
                type="text"
                placeholder="Search sports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-32 bg-transparent text-xs text-ink-700 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50">
                  <th className="tbl-th w-8"></th>
                  <th className="tbl-th">Sport</th>
                  <th className="tbl-th">Activities</th>
                  <th className="tbl-th">Enabled</th>
                  <th className="tbl-th w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {filtered.map((s) => (
                  <SportRow
                    key={s.id}
                    sport={s}
                    onUpdate={update}
                    onDelete={handleDelete}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-ink-200 md:hidden">
            {filtered.map((s) => (
              <div key={s.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{s.emoji}</span>
                    <div>
                      <p
                        className={`text-sm font-semibold ${s.enabled ? 'text-ink-900' : 'text-ink-400 line-through'}`}
                      >
                        {s.name}
                      </p>
                      <p className="text-xs text-ink-400">{s.activityCount} activities</p>
                    </div>
                  </div>
                  <Toggle
                    checked={s.enabled}
                    onChange={(v) => update(s.id, { enabled: v })}
                    size="md"
                  />
                </div>
                <div className="flex gap-1">
                  <SurfaceChip
                    label="Filter"
                    active={s.enabled && s.showInFilter}
                    tooltip="Discovery filter"
                  />
                  <SurfaceChip
                    label="Onboarding"
                    active={s.enabled && s.showInOnboarding}
                    tooltip="Onboarding picker"
                  />
                  <SurfaceChip
                    label="Host"
                    active={s.enabled && s.canHost}
                    tooltip="Can host activities"
                  />
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-400">No sports match your search.</p>
          )}
        </div>

        {/* Mobile preview sidebar */}
        <MobilePreview sports={sports} />
      </div>
    </div>
  );
}
