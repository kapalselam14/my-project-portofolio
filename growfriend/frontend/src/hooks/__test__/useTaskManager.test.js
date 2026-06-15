import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import useTaskManager from '../useTaskManager'

const TASKS = [
  { id: '1', status: 'open',   rewardCoins: 50, timeLimit: 60,  expiredAt: '2026-06-01' },
  { id: '2', status: 'active', rewardCoins: 10, timeLimit: 120, expiredAt: '2026-05-01' },
  { id: '3', status: 'open',   rewardCoins: 30, timeLimit: 30,  expiredAt: '2026-07-01' },
]

describe('useTaskManager', () => {
  it('returns all tasks when filter is "all"', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    expect(result.current.filteredTasks).toHaveLength(3)
  })

  it('filters by status', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.setFilterStatus('open'))
    expect(result.current.filteredTasks).toHaveLength(2)
    expect(result.current.filteredTasks.every((t) => t.status === 'open')).toBe(true)
  })

  it('sorts by reward-high', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.setSortBy('reward-high'))
    expect(result.current.filteredTasks.map((t) => t.rewardCoins)).toEqual([50, 30, 10])
  })

  it('sorts by reward-low', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.setSortBy('reward-low'))
    expect(result.current.filteredTasks.map((t) => t.rewardCoins)).toEqual([10, 30, 50])
  })

  it('sorts by timelimit-long', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.setSortBy('timelimit-long'))
    expect(result.current.filteredTasks.map((t) => t.timeLimit)).toEqual([120, 60, 30])
  })

  it('sorts by timelimit-short', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.setSortBy('timelimit-short'))
    expect(result.current.filteredTasks.map((t) => t.timeLimit)).toEqual([30, 60, 120])
  })

  it('sorts by expiry-early', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.setSortBy('expiry-early'))
    expect(result.current.filteredTasks.map((t) => t.expiredAt)).toEqual([
      '2026-05-01', '2026-06-01', '2026-07-01',
    ])
  })

  it('sorts by expiry-late', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.setSortBy('expiry-late'))
    expect(result.current.filteredTasks.map((t) => t.expiredAt)).toEqual([
      '2026-07-01', '2026-06-01', '2026-05-01',
    ])
  })

  it('toggles edit mode on/off and disables delete mode', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.toggleEditMode())
    expect(result.current.isEditMode).toBe(true)
    expect(result.current.isDeleteMode).toBe(false)
    act(() => result.current.toggleEditMode())
    expect(result.current.isEditMode).toBe(false)
  })

  it('toggles delete mode and clears edit mode', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.toggleEditMode())
    act(() => result.current.toggleDeleteMode())
    expect(result.current.isDeleteMode).toBe(true)
    expect(result.current.isEditMode).toBe(false)
  })

  it('resetModes disables both modes', () => {
    const { result } = renderHook(() => useTaskManager(TASKS))
    act(() => result.current.toggleEditMode())
    act(() => result.current.resetModes())
    expect(result.current.isEditMode).toBe(false)
    expect(result.current.isDeleteMode).toBe(false)
  })
})
