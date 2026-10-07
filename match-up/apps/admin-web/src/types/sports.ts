export interface SportConfig {
  id: string;
  name: string;
  emoji: string;
  enabled: boolean;
  showInFilter: boolean;
  showInOnboarding: boolean;
  canHost: boolean;
  sortOrder: number;
  /** Read-only stat computed server-side from the activities collection. */
  activityCount: number;
}
