// reports.
export type ReportStatus = 'Pending' | 'Resolved' | 'Dismissed';
export type ReportCategory =
  'Harassment' | 'Spam' | 'Policy Breach' | 'Fraud' | 'Inappropriate Content' | 'Other';

export interface Report {
  id: string;
  reporter: string;
  reporterAvatarSeed: string;
  reporterPhotoUrl?: string;
  target: string;
  targetType: 'user' | 'activity';
  reason: string;
  category: ReportCategory;
  activityTitle: string;
  sport: string;
  status: ReportStatus;
  createdAt: string;
  adminNote?: string;
  resolvedAt?: string;
}
