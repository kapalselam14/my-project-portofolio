import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import {
  updateProfile,
  updatePassword,
  identifyUserForReset,
  resetPasswordWithSecurityAnswer,
  getTaskStats,
} from '../userApi'

vi.mock('axios', () => ({
  default: {
    patch: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// ── updateProfile ────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  it('throws a 401 error when no token is stored', async () => {
    const err = await updateProfile({ name: 'Alice' }).catch(e => e)
    expect(err.message).toMatch(/not authenticated/i)
    expect(err.status).toBe(401)
  })

  it('does not call axios when no token is stored', async () => {
    await updateProfile({ name: 'Alice' }).catch(() => {})
    expect(axios.patch).not.toHaveBeenCalled()
  })

  it('calls the /me endpoint with a Bearer token', async () => {
    localStorage.setItem('token', 'tok')
    axios.patch.mockResolvedValue({ data: { name: 'Alice' } })
    await updateProfile({ name: 'Alice' })
    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/me'),
      { name: 'Alice' },
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    )
  })

  it('returns the response data on success', async () => {
    localStorage.setItem('token', 'tok')
    axios.patch.mockResolvedValue({ data: { id: 'u1', name: 'Alice' } })
    const result = await updateProfile({ name: 'Alice' })
    expect(result).toEqual({ id: 'u1', name: 'Alice' })
  })

  it('throws a wrapped error with status from axios failure', async () => {
    localStorage.setItem('token', 'tok')
    axios.patch.mockRejectedValue({ response: { status: 422, data: { message: 'Validation failed' } } })
    const err = await updateProfile({ name: '' }).catch(e => e)
    expect(err.message).toBe('Validation failed')
    expect(err.status).toBe(422)
  })

  it('falls back to the fallback message when the error has no message', async () => {
    localStorage.setItem('token', 'tok')
    axios.patch.mockRejectedValue({})
    const err = await updateProfile({}).catch(e => e)
    expect(err.message).toBe('Failed to update profile')
  })
})

// ── updatePassword ───────────────────────────────────────────────────────────

describe('updatePassword', () => {
  it('throws a 401 error when no token is stored', async () => {
    const err = await updatePassword({ currentPassword: 'old', newPassword: 'new' }).catch(e => e)
    expect(err.status).toBe(401)
  })

  it('calls the /me/password endpoint', async () => {
    localStorage.setItem('token', 'tok')
    axios.patch.mockResolvedValue({ data: { success: true } })
    await updatePassword({ currentPassword: 'old', newPassword: 'new' })
    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/me/password'),
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('returns the response data on success', async () => {
    localStorage.setItem('token', 'tok')
    axios.patch.mockResolvedValue({ data: { success: true } })
    const result = await updatePassword({ currentPassword: 'a', newPassword: 'b' })
    expect(result).toEqual({ success: true })
  })

  it('throws a wrapped error on failure', async () => {
    localStorage.setItem('token', 'tok')
    axios.patch.mockRejectedValue({ response: { status: 400, data: { message: 'Wrong password' } } })
    const err = await updatePassword({}).catch(e => e)
    expect(err.message).toBe('Wrong password')
    expect(err.status).toBe(400)
  })
})

// ── identifyUserForReset ─────────────────────────────────────────────────────

describe('identifyUserForReset', () => {
  it('calls the correct endpoint with identifier', async () => {
    axios.post.mockResolvedValue({ data: { success: true } })
    await identifyUserForReset('user@auckland.ac.nz')
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/forgot/identify'),
      { identifier: 'user@auckland.ac.nz' }
    )
  })

  it('returns the response data on success', async () => {
    axios.post.mockResolvedValue({ data: { userId: 'u1', question: 'What is your pet name?' } })
    const result = await identifyUserForReset('user@auckland.ac.nz')
    expect(result).toEqual({ userId: 'u1', question: 'What is your pet name?' })
  })

  it('throws a wrapped error on failure', async () => {
    axios.post.mockRejectedValue({ response: { status: 404, data: { message: 'User not found' } } })
    const err = await identifyUserForReset('unknown@example.com').catch(e => e)
    expect(err.message).toBe('User not found')
  })

  it('throws fallback message when the error has no message', async () => {
    axios.post.mockRejectedValue({})
    const err = await identifyUserForReset('a@b.com').catch(e => e)
    expect(err.message).toBe('Failed to identify user')
  })
})

// ── resetPasswordWithSecurityAnswer ──────────────────────────────────────────

describe('resetPasswordWithSecurityAnswer', () => {
  it('calls the correct endpoint with payload', async () => {
    const payload = { userId: 'u1', answer: 'mum', newPassword: 'NewPass1' }
    axios.post.mockResolvedValue({ data: { success: true } })
    await resetPasswordWithSecurityAnswer(payload)
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/forgot/reset'),
      payload
    )
  })

  it('returns the response data on success', async () => {
    axios.post.mockResolvedValue({ data: { success: true, message: 'Password reset' } })
    const result = await resetPasswordWithSecurityAnswer({ userId: 'u1', answer: 'x', newPassword: 'y' })
    expect(result.success).toBe(true)
  })

  it('throws a wrapped error on failure', async () => {
    axios.post.mockRejectedValue({ response: { status: 400, data: { message: 'Wrong answer' } } })
    const err = await resetPasswordWithSecurityAnswer({}).catch(e => e)
    expect(err.message).toBe('Wrong answer')
  })

  it('throws fallback message when the error has no message', async () => {
    axios.post.mockRejectedValue({})
    const err = await resetPasswordWithSecurityAnswer({}).catch(e => e)
    expect(err.message).toBe('Failed to reset password')
  })
})

// ── getTaskStats ─────────────────────────────────────────────────────────────

describe('getTaskStats', () => {
  it('throws a 401 error when no token is stored', async () => {
    const err = await getTaskStats().catch(e => e)
    expect(err.status).toBe(401)
    expect(err.message).toMatch(/not authenticated/i)
  })

  it('calls the /me/task-stats endpoint with Bearer token', async () => {
    localStorage.setItem('token', 'tok')
    axios.get.mockResolvedValue({ data: { completed: 5 } })
    await getTaskStats()
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/me/task-stats'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns the response data on success', async () => {
    localStorage.setItem('token', 'tok')
    axios.get.mockResolvedValue({ data: { completed: 3, inProgress: 1 } })
    const result = await getTaskStats()
    expect(result).toEqual({ completed: 3, inProgress: 1 })
  })

  it('throws a wrapped error on failure', async () => {
    localStorage.setItem('token', 'tok')
    axios.get.mockRejectedValue({ response: { status: 500, data: { message: 'Server error' } } })
    const err = await getTaskStats().catch(e => e)
    expect(err.message).toBe('Server error')
    expect(err.status).toBe(500)
  })
})
