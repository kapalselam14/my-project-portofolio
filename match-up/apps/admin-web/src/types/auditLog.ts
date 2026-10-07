// auditLog.
export type AuditCategory =
  'Members' | 'Activities' | 'Appeals' | 'Reports' | 'Broadcasts' | 'Sports' | 'Templates';

export type AuditAction =
  | 'member.status_change'
  | 'member.delete'
  | 'activity.status_change'
  | 'activity.delete'
  | 'appeal.approve'
  | 'appeal.reject'
  | 'report.resolve'
  | 'report.dismiss'
  | 'broadcast.create'
  | 'broadcast.update'
  | 'broadcast.send'
  | 'broadcast.delete'
  | 'sport.update'
  | 'sport.replace'
  | 'template.update';

export interface AuditLogEntry {
  id: string;
  category: AuditCategory;
  action: AuditAction;
  adminUid: string;
  adminEmail: string | null;
  description: string;
  targetId: string | null;
  targetLabel: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, string>;
  createdAt: string;
}
