import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import useModal from '../useModal'

describe('useModal', () => {
  it('starts closed with no modal type', () => {
    const { result } = renderHook(() => useModal())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.modalType).toBeNull()
  })

  it('opens a modal with the given type', () => {
    const { result } = renderHook(() => useModal())
    act(() => result.current.openModal('store'))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.modalType).toBe('store')
  })

  it('closes the modal and clears the type', () => {
    const { result } = renderHook(() => useModal())
    act(() => result.current.openModal('inventory'))
    act(() => result.current.closeModal())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.modalType).toBeNull()
  })

  it('switches modal types by opening again', () => {
    const { result } = renderHook(() => useModal())
    act(() => result.current.openModal('store'))
    act(() => result.current.openModal('inventory'))
    expect(result.current.modalType).toBe('inventory')
    expect(result.current.isOpen).toBe(true)
  })
})
