import { useState, useCallback, useEffect } from 'react';
import { fetchAuditLog } from '../services/auditLogService';
import type { AuditLogEntry } from '../services/auditLogService';

/** Loads the full recent audit log once; the page filters/searches/ paginates client-side over this set. */
export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The page performs its filters, search, and pagination over this recent-entry window.
      const rows = await fetchAuditLog({ limit: 200 });
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, entries, reload: load };
}
