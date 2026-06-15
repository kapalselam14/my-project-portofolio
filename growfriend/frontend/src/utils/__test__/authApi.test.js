import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { register, login, getCurrentUser, logout } from '../authApi'

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

// ── register ────────────────────────────────────────────────────────────────

describe('register', () => {
  it('saves token to localStorage on success', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, message: 'ok', data: { token: 'tok123', user: { id: 'u1' } } },
    })
    await register({ email: 'a@b.com', password: 'pw' })
    expect(localStorage.getItem('token')).toBe('tok123')
  })

  it('returns success flag and user object', async () => {
    const user = { id: 'u1', name: 'Alice' }
    axios.post.mockResolvedValue({
      data: { success: true, message: 'ok', data: { token: 'tok', user } },
    })
    const result = await register({ email: 'a@b.com', password: 'pw' })
    expect(result.success).toBe(true)
    expect(result.user).toEqual(user)
  })

  it('does not crash when response has no token', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, message: 'ok', data: { user: { id: 'u1' } } },
    })
    await expect(register({ email: 'a@b.com', password: 'pw' })).resolves.not.toThrow()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('throws with the server error message on failure', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Email already used' } } })
    await expect(register({ email: 'a@b.com', password: 'pw' })).rejects.toThrow('Email already used')
  })

  it('throws a fallback message when no server message is present', async () => {
    axios.post.mockRejectedValue(new Error('network error'))
    await expect(register({})).rejects.toThrow('failed to register')
  })
})

// ── login ───────────────────────────────────────────────────────────────────

describe('login', () => {
  it('saves token to localStorage on success', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, message: 'ok', data: { token: 'jwt-abc', user: { id: 'u2' } } },
    })
    await login('a@b.com', 'pw')
    expect(localStorage.getItem('token')).toBe('jwt-abc')
  })

  it('returns success flag and user object', async () => {
    const user = { id: 'u2', name: 'Bob' }
    axios.post.mockResolvedValue({
      data: { success: true, message: 'ok', data: { token: 'jwt', user } },
    })
    const result = await login('a@b.com', 'pw')
    expect(result.success).toBe(true)
    expect(result.user).toEqual(user)
  })

  it('throws with the server error message on failure', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } })
    await expect(login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })

  it('throws a fallback message when no server message is present', async () => {
    axios.post.mockRejectedValue(new Error('timeout'))
    await expect(login('a@b.com', 'pw')).rejects.toThrow('failed to login')
  })
})

// ── getCurrentUser ───────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  it('returns null immediately when no token is stored', async () => {
    const result = await getCurrentUser()
    expect(result).toBeNull()
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('calls the /me endpoint with the stored token', async () => {
    localStorage.setItem('token', 'mytoken')
    axios.get.mockResolvedValue({ data: { id: 'u1' } })
    await getCurrentUser()
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/me'),
      expect.objectContaining({ headers: { Authorization: 'Bearer mytoken' } })
    )
  })

  it('returns the response data on success', async () => {
    localStorage.setItem('token', 'mytoken')
    axios.get.mockResolvedValue({ data: { id: 'u1', name: 'Alice' } })
    const result = await getCurrentUser()
    expect(result).toEqual({ id: 'u1', name: 'Alice' })
  })

  it('returns null when the API call fails', async () => {
    localStorage.setItem('token', 'badtoken')
    axios.get.mockRejectedValue(new Error('401'))
    const result = await getCurrentUser()
    expect(result).toBeNull()
  })
})

// ── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('removes token from localStorage', () => {
    localStorage.setItem('token', 'tok')
    const setCurrentUser = vi.fn()
    logout(setCurrentUser)
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('calls setCurrentUser with null', () => {
    const setCurrentUser = vi.fn()
    logout(setCurrentUser)
    expect(setCurrentUser).toHaveBeenCalledWith(null)
  })
})
