import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getActivePet, activatePet, updateActivePetNickname, feedPet, evolvePet } from '../petApi'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

beforeEach(() => vi.clearAllMocks())

// ── getActivePet ─────────────────────────────────────────────────────────────

describe('getActivePet', () => {
  it('calls GET /api/pets/active with Bearer token', async () => {
    axios.get.mockResolvedValue({ data: { id: 'p1' } })
    await getActivePet('tok')
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/pets/active'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns res.data on success', async () => {
    const pet = { id: 'p1', stage: 'EGG', level: 3 }
    axios.get.mockResolvedValue({ data: pet })
    expect(await getActivePet('tok')).toEqual(pet)
  })

  it('throws a fixed message on failure', async () => {
    axios.get.mockRejectedValue(new Error('500'))
    await expect(getActivePet('tok')).rejects.toThrow('failed to fetch active pet')
  })
})

// ── activatePet ──────────────────────────────────────────────────────────────

describe('activatePet', () => {
  it('calls PATCH /api/pets/:id/activate with Bearer token', async () => {
    axios.patch.mockResolvedValue({ data: { success: true } })
    await activatePet('pet42', 'tok')
    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/api/pets/pet42/activate'),
      {},
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns res.data on success', async () => {
    axios.patch.mockResolvedValue({ data: { active: true } })
    expect(await activatePet('p1', 'tok')).toEqual({ active: true })
  })

  it('throws a fixed message on failure', async () => {
    axios.patch.mockRejectedValue(new Error('404'))
    await expect(activatePet('missing', 'tok')).rejects.toThrow('failed to activate pet')
  })
})

// ── updateActivePetNickname ──────────────────────────────────────────────────

describe('updateActivePetNickname', () => {
  it('calls PATCH /api/pets/active/nickname with nickname in body and Bearer token', async () => {
    axios.patch.mockResolvedValue({ data: {} })
    await updateActivePetNickname('Fluffy', 'tok')
    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/api/pets/active/nickname'),
      { nickname: 'Fluffy' },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns res.data on success', async () => {
    axios.patch.mockResolvedValue({ data: { nickname: 'Fluffy' } })
    expect(await updateActivePetNickname('Fluffy', 'tok')).toEqual({ nickname: 'Fluffy' })
  })

  it('uses nested error.response.data.error.message when present', async () => {
    axios.patch.mockRejectedValue({ response: { data: { error: { message: 'Nickname too long' } } } })
    await expect(updateActivePetNickname('x'.repeat(100), 'tok')).rejects.toThrow('Nickname too long')
  })

  it('falls back to error.response.data.message', async () => {
    axios.patch.mockRejectedValue({ response: { data: { message: 'Bad request' } } })
    await expect(updateActivePetNickname('', 'tok')).rejects.toThrow('Bad request')
  })

  it('falls back to fixed message on generic errors', async () => {
    axios.patch.mockRejectedValue(new Error('timeout'))
    await expect(updateActivePetNickname('x', 'tok')).rejects.toThrow('failed to update pet name')
  })
})

// ── feedPet ──────────────────────────────────────────────────────────────────

describe('feedPet', () => {
  it('calls POST /api/pets/:id/feed with itemCode in body', async () => {
    axios.post.mockResolvedValue({ data: { growthPoints: 10 } })
    await feedPet('p1', 'APPLE', 'tok')
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/pets/p1/feed'),
      { itemCode: 'APPLE' },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns res.data on success', async () => {
    axios.post.mockResolvedValue({ data: { growthPoints: 20 } })
    expect(await feedPet('p1', 'BERRY', 'tok')).toEqual({ growthPoints: 20 })
  })

  it('throws a fixed message on failure', async () => {
    axios.post.mockRejectedValue(new Error('not found'))
    await expect(feedPet('p1', 'BAD', 'tok')).rejects.toThrow('failed to feed pet')
  })
})

// ── evolvePet ────────────────────────────────────────────────────────────────

describe('evolvePet', () => {
  it('calls POST /api/pets/:id/evolve with Bearer token', async () => {
    axios.post.mockResolvedValue({ data: { stage: 'KID' } })
    await evolvePet('p1', 'tok')
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/pets/p1/evolve'),
      {},
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns res.data on success', async () => {
    axios.post.mockResolvedValue({ data: { stage: 'ADULT' } })
    expect(await evolvePet('p1', 'tok')).toEqual({ stage: 'ADULT' })
  })

  it('throws a fixed message on failure', async () => {
    axios.post.mockRejectedValue(new Error('pet not ready'))
    await expect(evolvePet('p1', 'tok')).rejects.toThrow('failed to evolve pet')
  })
})
