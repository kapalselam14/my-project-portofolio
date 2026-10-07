// appeals.
export type AppealStatus = 'Pending' | 'Approved' | 'Rejected';
export type AppealType = 'Suspension' | 'Activity Removal' | 'Account Ban' | 'Content Removal';

export interface Appeal {
  id: string;
  userId: string;
  userName: string;
  userAvatarSeed: string;
  userPhotoUrl?: string;
  userEmail: string;
  type: AppealType;
  originalAction: string;
  statement: string;
  status: AppealStatus;
  createdAt: string;
  resolvedAt?: string;
  adminResponse?: string;
  relatedId?: string;
}
