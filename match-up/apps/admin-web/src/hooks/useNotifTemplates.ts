// useNotifTemplates (hooks).
import { useState, useCallback, useEffect } from 'react';
import { fetchTemplates, updateTemplate } from '../services/templatesService';
import type { NotifTemplate } from '../services/templatesService';

export function useNotifTemplates() {
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use one fetch path for the initial request and any caller-triggered reload.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTemplates(await fetchTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Whitelist editable fields so identifiers or server-managed values are never sent in a patch.
  const handleUpdate = useCallback(async (id: string, patch: Partial<NotifTemplate>) => {
    const allowed = {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    };
    const updated = await updateTemplate(id, allowed);
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  // Read the current enabled value and route the toggle through the same update flow.
  const handleToggle = useCallback(
    async (id: string) => {
      const current = templates.find((t) => t.id === id);
      if (!current) return;
      await handleUpdate(id, { enabled: !current.enabled });
    },
    [templates, handleUpdate],
  );

  return { loading, error, templates, handleUpdate, handleToggle, reload: load };
}
