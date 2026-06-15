import { describe, it, expect } from 'vitest'
import { normalizeInventoryItems, normalizePetCollection } from '../inventoryApi'

// ── normalizeInventoryItems ─────────────────────────────────────────────────

describe('normalizeInventoryItems', () => {
  it('returns a plain array as-is', () => {
    const items = [{ id: '1' }, { id: '2' }]
    expect(normalizeInventoryItems(items)).toBe(items)
  })

  it('extracts .data when response is wrapped', () => {
    const items = [{ id: '1' }]
    expect(normalizeInventoryItems({ data: items })).toBe(items)
  })

  it('extracts .items when response has items property', () => {
    const items = [{ id: '1' }]
    expect(normalizeInventoryItems({ items })).toBe(items)
  })

  it('extracts .inventoryItems when response has inventoryItems property', () => {
    const items = [{ id: '1' }]
    expect(normalizeInventoryItems({ inventoryItems: items })).toBe(items)
  })

  it('extracts .data.items when nested', () => {
    const items = [{ id: '1' }]
    expect(normalizeInventoryItems({ data: { items } })).toBe(items)
  })

  it('returns empty array for null input', () => {
    expect(normalizeInventoryItems(null)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(normalizeInventoryItems(undefined)).toEqual([])
  })

  it('returns empty array when response has no recognised shape', () => {
    expect(normalizeInventoryItems({ unrelated: 'value' })).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(normalizeInventoryItems({})).toEqual([])
  })

  it('handles an empty items array', () => {
    expect(normalizeInventoryItems({ items: [] })).toEqual([])
  })
})

// ── normalizePetCollection ──────────────────────────────────────────────────

describe('normalizePetCollection', () => {
  it('returns a plain array as-is', () => {
    const pets = [{ id: 'p1' }, { id: 'p2' }]
    expect(normalizePetCollection(pets)).toBe(pets)
  })

  it('extracts .data when response is wrapped', () => {
    const pets = [{ id: 'p1' }]
    expect(normalizePetCollection({ data: pets })).toBe(pets)
  })

  it('extracts .pets when response has pets property', () => {
    const pets = [{ id: 'p1' }]
    expect(normalizePetCollection({ pets })).toBe(pets)
  })

  it('extracts .inactivePets when response has inactivePets property', () => {
    const pets = [{ id: 'p1' }]
    expect(normalizePetCollection({ inactivePets: pets })).toBe(pets)
  })

  it('extracts .data.pets when nested', () => {
    const pets = [{ id: 'p1' }]
    expect(normalizePetCollection({ data: { pets } })).toBe(pets)
  })

  it('returns empty array for null input', () => {
    expect(normalizePetCollection(null)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(normalizePetCollection(undefined)).toEqual([])
  })

  it('returns empty array when response has no recognised shape', () => {
    expect(normalizePetCollection({ unrelated: 'value' })).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(normalizePetCollection({})).toEqual([])
  })

  it('handles an empty pets array', () => {
    expect(normalizePetCollection({ pets: [] })).toEqual([])
  })
})
