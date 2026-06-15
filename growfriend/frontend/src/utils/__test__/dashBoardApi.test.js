import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getDashboard } from '../dashBoardApi'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('getDashboard', () => {
  it('calls the /api/dashboard endpoint with a Bearer token', async () => {
    axios.get.mockResolvedValue({ data: { user: {}, pet: {} } })
    await getDashboard('tok')
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns res.data on success', async () => {
    const payload = { user: { id: 'u1', coins: 30 }, pet: { stage: 'EGG' } }
    axios.get.mockResolvedValue({ data: payload })
    const result = await getDashboard('tok')
    expect(result).toEqual(payload)
  })

  it('throws with nested error.response.data.error.message', async () => {
    axios.get.mockRejectedValue({ response: { data: { error: { message: 'Nested error' } } } })
    await expect(getDashboard('tok')).rejects.toThrow('Nested error')
  })

  it('throws with error.response.data.message', async () => {
    axios.get.mockRejectedValue({ response: { data: { message: 'Unauthorised' } } })
    await expect(getDashboard('tok')).rejects.toThrow('Unauthorised')
  })

  it('throws with error.message when no response body', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'))
    await expect(getDashboard('tok')).rejects.toThrow('Network Error')
  })

  it('throws the fallback message when no message is present', async () => {
    axios.get.mockRejectedValue({})
    await expect(getDashboard('tok')).rejects.toThrow('failed to fetch dashboard')
  })
})
