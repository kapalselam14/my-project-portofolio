// broadcasts.
export type BroadcastStatus = 'Sent' | 'Scheduled' | 'Draft';
export type BroadcastAudience = 'All Users' | 'Hosts Only' | 'Players Only' | 'Inactive Users';

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  audience: BroadcastAudience;
  status: BroadcastStatus;
  sentAt?: string;
  scheduledAt?: string;
  recipients: number;
  openRate?: number;
}
