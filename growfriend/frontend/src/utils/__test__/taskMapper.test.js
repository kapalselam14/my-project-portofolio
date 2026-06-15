import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  toFrontend,
  toFrontendList,
  userCreateToBackend,
  TYPE_B2F,
  TYPE_F2B,
  STATUS_B2F,
  STATUS_F2B,
} from '../taskMapper'

// ── toFrontend ─────────────────────────────────────────────────────────────

describe('toFrontend', () => {
  it('maps SYSTEM type to "community"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.type).toBe('community')
  })

  it('maps P2P type to "p2p"', () => {
    const result = toFrontend({ id: '2', type: 'P2P', status: 'OPEN', createdBy: 'u1' })
    expect(result.type).toBe('p2p')
  })

  it('maps PERSONAL type to "mytask"', () => {
    const result = toFrontend({ id: '3', type: 'PERSONAL', status: 'OPEN', createdBy: 'u1' })
    expect(result.type).toBe('mytask')
  })

  it('maps OPEN status to "open"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.status).toBe('open')
  })

  it('maps IN_PROGRESS status to "active"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'IN_PROGRESS', createdBy: 'u1' })
    expect(result.status).toBe('active')
  })

  it('maps PENDING_CONFIRMATION status to "pending_confirmation"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'PENDING_CONFIRMATION', createdBy: 'u1' })
    expect(result.status).toBe('pending_confirmation')
  })

  it('maps COMPLETED status to "completed"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'COMPLETED', createdBy: 'u1' })
    expect(result.status).toBe('completed')
  })

  it('maps CANCELLED status to "cancelled"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'CANCELLED', createdBy: 'u1' })
    expect(result.status).toBe('cancelled')
  })

  it('maps DISPUTED status to "disputed"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'DISPUTED', createdBy: 'u1' })
    expect(result.status).toBe('disputed')
  })

  it('maps CLOSED status to "completed"', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'CLOSED', createdBy: 'u1' })
    expect(result.status).toBe('completed')
  })

  it('computes "expired" when endAt is past and status is OPEN', () => {
    const result = toFrontend({
      id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1',
      endAt: '2020-01-01T00:00:00.000Z',
    })
    expect(result.status).toBe('expired')
  })

  it('does NOT compute "expired" for non-OPEN status even if endAt is past', () => {
    const result = toFrontend({
      id: '1', type: 'SYSTEM', status: 'IN_PROGRESS', createdBy: 'u1',
      endAt: '2020-01-01T00:00:00.000Z',
    })
    expect(result.status).toBe('active')
  })

  it('does NOT compute "expired" when endAt is in the future', () => {
    const result = toFrontend({
      id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1',
      endAt: '2099-01-01T00:00:00.000Z',
    })
    expect(result.status).toBe('open')
  })

  it('coerces id to string', () => {
    const result = toFrontend({ id: 42, type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.id).toBe('42')
  })

  it('maps description to instructions', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1', description: 'do this' })
    expect(result.instructions).toBe('do this')
  })

  it('defaults objectives to empty array when missing', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.objectives).toEqual([])
  })

  it('preserves objectives array', () => {
    const result = toFrontend({
      id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1',
      objectives: ['obj1', 'obj2'],
    })
    expect(result.objectives).toEqual(['obj1', 'obj2'])
  })

  it('defaults rewardCoins to 0 when missing', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.rewardCoins).toBe(0)
  })

  it('maps assignee with nested id/name', () => {
    const result = toFrontend({
      id: '1', type: 'P2P', status: 'IN_PROGRESS', createdBy: 'u1',
      assignee: { id: 'a1', name: 'Alice' },
    })
    expect(result.assignee).toEqual({ id: 'a1', name: 'Alice' })
  })

  it('maps assignee using _id when id is absent', () => {
    const result = toFrontend({
      id: '1', type: 'P2P', status: 'IN_PROGRESS', createdBy: 'u1',
      assignee: { _id: 'a2', name: 'Bob' },
    })
    expect(result.assignee).toEqual({ id: 'a2', name: 'Bob' })
  })

  it('sets assignee to null when absent', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.assignee).toBeNull()
  })

  it('maps createdBy object', () => {
    const result = toFrontend({
      id: '1', type: 'SYSTEM', status: 'OPEN',
      createdBy: { id: 'c1', name: 'Creator' },
    })
    expect(result.createdBy).toEqual({ id: 'c1', name: 'Creator' })
  })

  it('maps createdBy string id', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'uid99' })
    expect(result.createdBy).toEqual({ id: 'uid99', name: '' })
  })

  it('maps endAt to expiredAt', () => {
    const result = toFrontend({
      id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1',
      endAt: '2099-12-31',
    })
    expect(result.expiredAt).toBe('2099-12-31')
  })

  it('defaults expiredAt to null when endAt absent', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.expiredAt).toBeNull()
  })

  it('defaults timeLimit to null', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.timeLimit).toBeNull()
  })

  it('defaults acceptedCount to 0', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.acceptedCount).toBe(0)
  })

  it('defaults isAcceptedByMe to false', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.isAcceptedByMe).toBe(false)
  })

  it('defaults rejectedAt to null', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.rejectedAt).toBeNull()
  })

  it('defaults dispute fields to null', () => {
    const result = toFrontend({ id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' })
    expect(result.disputeRaisedBy).toBeNull()
    expect(result.disputeReason).toBeNull()
    expect(result.disputeDetails).toBeNull()
  })

  it('falls back to lowercased type for unknown backend type', () => {
    const result = toFrontend({ id: '1', type: 'UNKNOWN_TYPE', status: 'OPEN', createdBy: 'u1' })
    expect(result.type).toBe('unknown_type')
  })
})

// ── toFrontendList ──────────────────────────────────────────────────────────

describe('toFrontendList', () => {
  it('returns an empty array for empty input', () => {
    expect(toFrontendList([])).toEqual([])
  })

  it('maps every item in the array', () => {
    const tasks = [
      { id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' },
      { id: '2', type: 'P2P', status: 'IN_PROGRESS', createdBy: 'u2' },
    ]
    const result = toFrontendList(tasks)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('1')
    expect(result[1].id).toBe('2')
  })

  it('each item has a valid frontend type', () => {
    const tasks = [
      { id: '1', type: 'SYSTEM', status: 'OPEN', createdBy: 'u1' },
      { id: '2', type: 'P2P', status: 'OPEN', createdBy: 'u1' },
      { id: '3', type: 'PERSONAL', status: 'OPEN', createdBy: 'u1' },
    ]
    const result = toFrontendList(tasks)
    expect(result.map(t => t.type)).toEqual(['community', 'p2p', 'mytask'])
  })
})

// ── userCreateToBackend ─────────────────────────────────────────────────────

describe('userCreateToBackend', () => {
  it('converts frontend type "p2p" to backend "P2P"', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 10 })
    expect(result.type).toBe('P2P')
  })

  it('converts frontend type "mytask" to backend "PERSONAL"', () => {
    const result = userCreateToBackend({ type: 'mytask', title: 'T', rewardCoins: 5 })
    expect(result.type).toBe('PERSONAL')
  })

  it('converts frontend type "community" to backend "SYSTEM"', () => {
    const result = userCreateToBackend({ type: 'community', title: 'T', rewardCoins: 0 })
    expect(result.type).toBe('SYSTEM')
  })

  it('uses instructions field as description', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', instructions: 'do it', rewardCoins: 0 })
    expect(result.description).toBe('do it')
  })

  it('falls back to description field when instructions is absent', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', description: 'fallback', rewardCoins: 0 })
    expect(result.description).toBe('fallback')
  })

  it('defaults description to empty string when neither field present', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 0 })
    expect(result.description).toBe('')
  })

  it('filters blank objectives', () => {
    const result = userCreateToBackend({
      type: 'p2p', title: 'T', rewardCoins: 0,
      objectives: ['  ', 'valid', ''],
    })
    expect(result.objectives).toEqual(['valid'])
  })

  it('defaults objectives to empty array when missing', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 0 })
    expect(result.objectives).toEqual([])
  })

  it('coerces rewardCoins to a number', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: '20' })
    expect(result.rewardCoins).toBe(20)
  })

  it('defaults rewardCoins to 0 for falsy value', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: '' })
    expect(result.rewardCoins).toBe(0)
  })

  it('converts timeLimit to a number', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 0, timeLimit: '30' })
    expect(result.timeLimit).toBe(30)
  })

  it('sets timeLimit to null when absent', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 0 })
    expect(result.timeLimit).toBeNull()
  })

  it('sets endAt to null when absent', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 0 })
    expect(result.endAt).toBeNull()
  })

  it('preserves endAt when provided', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 0, endAt: '2026-12-31' })
    expect(result.endAt).toBe('2026-12-31')
  })

  it('always sets requiresApplication to false', () => {
    const result = userCreateToBackend({ type: 'p2p', title: 'T', rewardCoins: 0 })
    expect(result.requiresApplication).toBe(false)
  })
})

// ── exported maps ────────────────────────────────────────────────────────────

describe('TYPE_B2F / TYPE_F2B round-trip', () => {
  it('every TYPE_B2F value round-trips through TYPE_F2B', () => {
    for (const [backend, frontend] of Object.entries(TYPE_B2F)) {
      expect(TYPE_F2B[frontend]).toBe(backend)
    }
  })
})

describe('STATUS_B2F / STATUS_F2B', () => {
  it('STATUS_B2F covers all documented backend statuses', () => {
    const expected = ['OPEN', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'CLOSED']
    for (const s of expected) {
      expect(STATUS_B2F).toHaveProperty(s)
    }
  })

  it('STATUS_F2B covers all documented frontend statuses', () => {
    const expected = ['open', 'active', 'pending_confirmation', 'pending_review', 'completed', 'cancelled', 'disputed']
    for (const s of expected) {
      expect(STATUS_F2B).toHaveProperty(s)
    }
  })

  it('pending_review and pending_confirmation map to the same backend value', () => {
    expect(STATUS_F2B['pending_review']).toBe(STATUS_F2B['pending_confirmation'])
  })
})
