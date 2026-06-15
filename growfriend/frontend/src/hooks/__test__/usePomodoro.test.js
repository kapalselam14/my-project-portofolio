import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import usePomodoro, { MODES } from '../usePomodoro'

vi.mock('../../utils/pomodoroApi', () => ({
  startFocusSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
  completeFocusSession: vi.fn().mockResolvedValue({ coins: 10 }),
  getActiveFocusSession: vi.fn().mockRejectedValue({ response: { status: 404 } }),
}))

describe('usePomodoro', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initializes in focus mode with correct duration', () => {
    const { result } = renderHook(() => usePomodoro())
    expect(result.current.mode).toBe('focus')
    expect(result.current.timeLeft).toBe(MODES.focus.duration)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isPaused).toBe(false)
  })

  it('exposes correct MODES constants', () => {
    const { result } = renderHook(() => usePomodoro())
    expect(result.current.MODES.focus.duration).toBe(25 * 60)
    expect(result.current.MODES.short.duration).toBe(5 * 60)
    expect(result.current.MODES.long.duration).toBe(15 * 60)
  })

  it('formatTime pads minutes and seconds correctly', () => {
    const { result } = renderHook(() => usePomodoro())
    expect(result.current.formatTime(0)).toBe('00:00')
    expect(result.current.formatTime(90)).toBe('01:30')
    expect(result.current.formatTime(3599)).toBe('59:59')
  })

  it('requestPause shows the pause warning in focus mode', () => {
    const { result } = renderHook(() => usePomodoro())
    act(() => result.current.requestPause())
    expect(result.current.showPauseWarning).toBe(true)
  })

  it('cancelPauseWarning hides the pause warning', () => {
    const { result } = renderHook(() => usePomodoro())
    act(() => result.current.requestPause())
    act(() => result.current.cancelPauseWarning())
    expect(result.current.showPauseWarning).toBe(false)
  })

  it('confirmPause pauses the timer', async () => {
    const { result } = renderHook(() => usePomodoro())
    await act(async () => { await result.current.start() })
    act(() => result.current.requestPause())
    act(() => result.current.confirmPause())
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isPaused).toBe(true)
    expect(result.current.showPauseWarning).toBe(false)
  })

  it('start sets isRunning to true', async () => {
    const { result } = renderHook(() => usePomodoro())
    await act(async () => { await result.current.start() })
    expect(result.current.isRunning).toBe(true)
  })

  it('requestSwitchMode shows confirm dialog when timer is running', async () => {
    const { result } = renderHook(() => usePomodoro())
    await act(async () => { await result.current.start() })
    act(() => result.current.requestSwitchMode('short'))
    expect(result.current.showModeResetConfirm).toBe(true)
    expect(result.current.pendingMode).toBe('short')
  })

  it('cancelModeReset hides the confirm dialog', async () => {
    const { result } = renderHook(() => usePomodoro())
    await act(async () => { await result.current.start() })
    act(() => result.current.requestSwitchMode('short'))
    act(() => result.current.cancelModeReset())
    expect(result.current.showModeResetConfirm).toBe(false)
    expect(result.current.pendingMode).toBeNull()
  })

  it('bubbleMessages contain a title and text for each mode', () => {
    const { result } = renderHook(() => usePomodoro())
    const msg = result.current.bubbleMessage
    expect(msg).toHaveProperty('title')
    expect(msg).toHaveProperty('text')
  })

  it('petProgress is 0 at the start of a session', () => {
    const { result } = renderHook(() => usePomodoro())
    expect(result.current.petProgress).toBe(0)
  })
})
