import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { logAdminAction } from './audit.service.js';

/** Push-notification template library. */
export type TemplateView = {
  id: string;
  trigger: string;
  category: string;
  name: string;
  description: string;
  title: string;
  body: string;
  variables: string[];
  enabled: boolean;
  lastEditedAt: string | null;
};

export type UpdateTemplateInput = {
  title?: unknown;
  body?: unknown;
  enabled?: unknown;
};

function toIso(value: unknown): string | null {
  if (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function mapTemplate(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): TemplateView | null {
  if (!data || typeof data.trigger !== 'string') return null;
  return {
    id,
    trigger: data.trigger,
    category: typeof data.category === 'string' ? data.category : '',
    name: typeof data.name === 'string' ? data.name : data.trigger,
    description: typeof data.description === 'string' ? data.description : '',
    title: typeof data.title === 'string' ? data.title : '',
    body: typeof data.body === 'string' ? data.body : '',
    variables: asStringArray(data.variables),
    enabled: data.enabled !== false,
    lastEditedAt: toIso(data.lastEditedAt ?? data.updatedAt),
  };
}

export async function listTemplates(): Promise<TemplateView[]> {
  // Return the configured notification templates in stable display order.
  const snap = await firestore.collection('notificationTemplates').get();
  const rows: TemplateView[] = [];
  for (const doc of snap.docs) {
    const view = mapTemplate(doc.id, doc.data());
    if (view) rows.push(view);
  }
  rows.sort((a, b) => a.trigger.localeCompare(b.trigger));
  return rows;
}

/** Update editable template copy only; trigger, category, and variables stay immutable. */
export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<TemplateView> {
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error('templateId is required');
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new Error('title is required');
    patch.title = title;
  }
  if (input.body !== undefined) {
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (!body) throw new Error('body is required');
    patch.body = body;
  }
  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'boolean') {
      throw new Error('enabled must be a boolean');
    }
    patch.enabled = input.enabled;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error('No updatable template fields provided');
  }
  const ref = firestore.collection('notificationTemplates').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Template not found');
  const before = snap.data();
  const now = Timestamp.now();
  await ref.update({ ...patch, lastEditedAt: now, updatedAt: now });
  const updated = await ref.get();
  const view = mapTemplate(ref.id, updated.data());
  if (!view) throw new Error('Template not found');
  await logAdminAction({
    category: 'Templates',
    action: 'template.update',
    adminUid,
    adminEmail,
    description: `Updated template "${view.name}"`,
    targetId: normalizedId,
    targetLabel: view.name,
    before: {
      title: before?.title ?? null,
      body: before?.body ?? null,
      enabled: before?.enabled ?? null,
    },
    after: patch,
  });
  return view;
}
