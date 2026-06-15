import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { getStoreItems, purchaseItem } from '../storeApi'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

beforeEach(() => vi.clearAllMocks())

// ── getStoreItems ─────────────────────────────────────────────────────────────

describe('getStoreItems', () => {
  it('calls GET /api/store/items with Bearer token', async () => {
    axios.get.mockResolvedValue({ data: [] })
    await getStoreItems('tok')
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/store/items'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('returns res.data on success', async () => {
    const items = [{ code: 'APPLE', price: 5 }, { code: 'BERRY', price: 10 }]
    axios.get.mockResolvedValue({ data: items })
    expect(await getStoreItems('tok')).toEqual(items)
  })

  it('throws with nested error.response.data.error.message', async () => {
    axios.get.mockRejectedValue({ response: { data: { error: { message: 'Store unavailable' } } } })
    await expect(getStoreItems('tok')).rejects.toThrow('Store unavailable')
  })

  it('throws with error.response.data.message', async () => {
    axios.get.mockRejectedValue({ response: { data: { message: 'Forbidden' } } })
    await expect(getStoreItems('tok')).rejects.toThrow('Forbidden')
  })

  it('throws with error.message on network failure', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'))
    await expect(getStoreItems('tok')).rejects.toThrow('Network Error')
  })

  it('throws fallback message when no message is present', async () => {
    axios.get.mockRejectedValue({})
    await expect(getStoreItems('tok')).rejects.toThrow('failed to fetch store items')
  })
})

// ── purchaseItem ──────────────────────────────────────────────────────────────

describe('purchaseItem', () => {
  it('calls POST /api/store/purchase with itemCode and quantity', async () => {
    axios.post.mockResolvedValue({ data: { success: true } })
    await purchaseItem('APPLE', 2, 'tok')
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/store/purchase'),
      { itemCode: 'APPLE', quantity: 2 },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
  })

  it('uses quantity 1 by default', async () => {
    axios.post.mockResolvedValue({ data: { success: true } })
    await purchaseItem('BERRY', undefined, 'tok')
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      { itemCode: 'BERRY', quantity: 1 },
      expect.any(Object)
    )
  })

  it('returns res.data on success', async () => {
    const data = { newBalance: 25, item: { code: 'APPLE' } }
    axios.post.mockResolvedValue({ data })
    expect(await purchaseItem('APPLE', 1, 'tok')).toEqual(data)
  })

  it('throws with nested error.response.data.error.message', async () => {
    axios.post.mockRejectedValue({ response: { data: { error: { message: 'Insufficient coins' } } } })
    await expect(purchaseItem('RARE', 1, 'tok')).rejects.toThrow('Insufficient coins')
  })

  it('throws with error.response.data.message', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Item not found' } } })
    await expect(purchaseItem('MISSING', 1, 'tok')).rejects.toThrow('Item not found')
  })

  it('throws with error.message on network failure', async () => {
    axios.post.mockRejectedValue(new Error('timeout'))
    await expect(purchaseItem('APPLE', 1, 'tok')).rejects.toThrow('timeout')
  })

  it('throws fallback message when no message is present', async () => {
    axios.post.mockRejectedValue({})
    await expect(purchaseItem('APPLE', 1, 'tok')).rejects.toThrow('failed to purchase item')
  })
})
