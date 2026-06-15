import { describe, it, expect } from 'vitest'
import { getDisplayStatus } from '../taskUtils'

describe('getDisplayStatus', () => {
  it('returns "rejected" when active task has rejectedAt', () => {
    const task = { status: 'active', rejectedAt: '2026-05-01' }
    expect(getDisplayStatus(task)).toBe('rejected')
  })

  it('returns "rejected" in creator view when assignee has lastRejectedAt', () => {
    const task = { status: 'active', assignee: { id: 'u2' }, lastRejectedAt: '2026-05-01' }
    expect(getDisplayStatus(task, false, true)).toBe('rejected')
  })

  it('does not return "rejected" for creator view without lastRejectedAt', () => {
    const task = { status: 'active', assignee: { id: 'u2' } }
    expect(getDisplayStatus(task, false, true)).toBe('active')
  })

  it('returns "active" when task is open and the user has accepted it', () => {
    const task = { status: 'open' }
    expect(getDisplayStatus(task, true, false)).toBe('active')
  })

  it('returns the raw task status as a fallback', () => {
    expect(getDisplayStatus({ status: 'completed' })).toBe('completed')
    expect(getDisplayStatus({ status: 'disputed' })).toBe('disputed')
    expect(getDisplayStatus({ status: 'cancelled' })).toBe('cancelled')
  })

  it('prioritises rejectedAt check over isAccepted', () => {
    const task = { status: 'active', rejectedAt: '2026-05-01' }
    expect(getDisplayStatus(task, true)).toBe('rejected')
  })

  it('returns the raw status when task is open and not accepted', () => {
    expect(getDisplayStatus({ status: 'open' }, false, false)).toBe('open')
  })

  it('returns the raw status for pending_confirmation', () => {
    expect(getDisplayStatus({ status: 'pending_confirmation' })).toBe('pending_confirmation')
  })

  it('does not return "rejected" in creator view when lastRejectedAt is absent', () => {
    const task = { status: 'active', assignee: { id: 'u2' } }
    expect(getDisplayStatus(task, false, true)).toBe('active')
  })

  it('ignores lastRejectedAt on non-active status in creator view', () => {
    const task = { status: 'pending_confirmation', assignee: { id: 'u2' }, lastRejectedAt: '2026-05-01' }
    expect(getDisplayStatus(task, false, true)).toBe('pending_confirmation')
  })

  it('ignores lastRejectedAt when assignee is absent in creator view', () => {
    const task = { status: 'active', lastRejectedAt: '2026-05-01' }
    expect(getDisplayStatus(task, false, true)).toBe('active')
  })

})
