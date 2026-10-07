import { useState, useCallback, useEffect } from 'react';
import { fetchAppeals, decideAppeal } from '../services/appealsService';
import type { Appeal } from '../services/appealsService';

export function useAppeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load every status because the page switches tabs locally without another request.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The page tabs filter locally — load every triage state up front.
      const [pending, approved, rejected] = await Promise.all([
        fetchAppeals('Pending'),
        fetchAppeals('Approved'),
        fetchAppeals('Rejected'),
      ]);
      setAppeals([...pending, ...approved, ...rejected]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appeals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Replace only the decided row with the server's authoritative response.
  const handleDecision = useCallback(
    async (id: string, decision: 'approve' | 'reject', response: string) => {
      const updated = await decideAppeal(id, decision, response);
      setAppeals((prev) => prev.map((a) => (a.id === id ? updated : a)));
    },
    [],
  );

  return { loading, error, appeals, handleDecision, reload: load };
}
