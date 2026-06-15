import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { startFocusSession, completeFocusSession, getActiveFocusSession } from '../pomodoroApi'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// ── startFocusSession ────────────────────────────────────────────────────────

describe('startFocusSession', () => {
  it('sends plannedDurationSec in the body when provided', async () => {
    axios.post.mockResolvedValue({ data: { id: 's1' } })
    await startFocusSession(1500)
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/focus/start'),
      { plannedDurationSec: 1500 },
      expect.any(Object)
    )
  })

  it('sends an empty body when no duration is provided', async () => {
    axios.post.mockResolvedValue({ data: { id: 's1' } })
    await startFocusSession()
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/focus/start'),
      {},
      expect.any(Object)
    )
  })

  it('sends an empty body when duration is 0 (falsy)', async () => {
    axios.post.mockResolvedValue({ data: { id: 's1' } })
    await startFocusSession(0)
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/focus/start'),
      {},
      expect.any(Object)
    )
  })

  it('returns res.data on success', async () => {
    axios.post.mockResolvedValue({ data: { id: 'session-1', status: 'active' } })
    const result = await startFocusSession(600)
    expect(result).toEqual({ id: 'session-1', status: 'active' })
  })

  it('includes Authorization header when token is present', async () => {
    localStorage.setItem('token', 'mytoken')
    axios.post.mockResolvedValue({ data: {} })
    await startFocusSession(300)
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ headers: { Authorization: 'Bearer mytoken' } })
    )
  })

  it('sends empty headers object when no token', async () => {
    axios.post.mockResolvedValue({ data: {} })
    await startFocusSession(300)
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ headers: {} })
    )
  })

  it('propagates axios errors', async () => {
    axios.post.mockRejectedValue(new Error('network'))
    await expect(startFocusSession(300)).rejects.toThrow('network')
  })
})

// ── completeFocusSession ─────────────────────────────────────────────────────

describe('completeFocusSession', () => {
  it('uses the "complete" endpoint by default', async () => {
    axios.post.mockResolvedValue({ data: { coins: 10 } })
    await completeFocusSession('s1')
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/focus/s1/complete'),
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('uses the "complete" endpoint when cancelled is false', async () => {
    axios.post.mockResolvedValue({ data: { coins: 10 } })
    await completeFocusSession('s1', { cancelled: false })
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/focus/s1/complete'),
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('uses the "cancel" endpoint when cancelled is true', async () => {
    axios.post.mockResolvedValue({ data: {} })
    await completeFocusSession('abc123', { cancelled: true })
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/focus/abc123/cancel'),
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('returns res.data on success', async () => {
    axios.post.mockResolvedValue({ data: { coins: 15, growthPoints: 5 } })
    const result = await completeFocusSession('s1')
    expect(result).toEqual({ coins: 15, growthPoints: 5 })
  })

  it('works when called without an options argument', async () => {
    axios.post.mockResolvedValue({ data: {} })
    await expect(completeFocusSession('s1')).resolves.not.toThrow()
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('complete'),
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('propagates axios errors', async () => {
    axios.post.mockRejectedValue(new Error('timeout'))
    await expect(completeFocusSession('s1')).rejects.toThrow('timeout')
  })
})

// ── getActiveFocusSession ────────────────────────────────────────────────────

describe('getActiveFocusSession', () => {
  it('calls the /api/focus/active endpoint', async () => {
    axios.get.mockResolvedValue({ data: { id: 's1', status: 'active' } })
    await getActiveFocusSession()
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/focus/active'),
      expect.any(Object)
    )
  })

  it('returns res.data on success', async () => {
    const session = { id: 's1', plannedDurationSec: 1500 }
    axios.get.mockResolvedValue({ data: session })
    const result = await getActiveFocusSession()
    expect(result).toEqual(session)
  })

  it('includes Authorization header when token is present', async () => {
    localStorage.setItem('token', 'tok42')
    axios.get.mockResolvedValue({ data: {} })
    await getActiveFocusSession()
    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok42' } })
    )
  })

  it('propagates axios errors', async () => {
    axios.get.mockRejectedValue(new Error('404'))
    await expect(getActiveFocusSession()).rejects.toThrow('404')
  })
})
