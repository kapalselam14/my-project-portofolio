// templates.
export type TemplateCategory = 'Activity' | 'Account' | 'Moderation' | 'Engagement';
export type TemplateTrigger =
  | 'activity.joined'
  | 'activity.cancelled'
  | 'activity.reminder'
  | 'activity.full'
  | 'activity.starting_soon'
  | 'account.suspended'
  | 'account.reactivated'
  | 'account.welcome'
  | 'moderation.report_resolved'
  | 'moderation.appeal_approved'
  | 'moderation.appeal_rejected'
  | 'engagement.inactive'
  | 'engagement.new_activity_nearby';

export interface NotifTemplate {
  id: string;
  trigger: TemplateTrigger;
  category: TemplateCategory;
  name: string;
  description: string;
  title: string;
  body: string;
  variables: string[];
  enabled: boolean;
  lastEditedAt: string;
}
