export function getDisplayStatus(task, isAccepted = false, isCreatorView = false) {
  if (task.status === 'active' && task.rejectedAt) return 'rejected'
  // Creator sees rejected badge when assignee's submission was rejected (task back to active)
  if (isCreatorView && task.status === 'active' && task.assignee && task.lastRejectedAt) return 'rejected'
  if (isAccepted && task.status === 'open') return 'active'
  return task.status
}
