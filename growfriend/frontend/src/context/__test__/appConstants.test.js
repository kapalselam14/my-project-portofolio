import { describe, it, expect } from 'vitest'
import { isValidUniEmail, isValidPassword, isValidDob, ALLOWED_DOMAINS } from '../appConstants'

describe('isValidUniEmail', () => {
  it.each([
    'student@auckland.ac.nz',
    'student@aucklanduni.ac.nz',
    'STUDENT@AUCKLAND.AC.NZ',
  ])('accepts valid UoA email: %s', (email) => {
    expect(isValidUniEmail(email)).toBe(true)
  })

  it.each([
    'user@gmail.com',
    'user@yahoo.com',
    'user@auckland.ac',
    'user@aucklanduni.ac',
    '',
    'notanemail',
  ])('rejects non-UoA email: %s', (email) => {
    expect(isValidUniEmail(email)).toBe(false)
  })

  it('validates against all allowed domains', () => {
    ALLOWED_DOMAINS.forEach((domain) => {
      expect(isValidUniEmail(`test${domain}`)).toBe(true)
    })
  })
})

describe('isValidPassword', () => {
  it('accepts a valid password with uppercase, lowercase, and digit', () => {
    expect(isValidPassword('Password1')).toBe(true)
    expect(isValidPassword('Abcdefg1')).toBe(true)
  })

  it('rejects passwords shorter than 8 characters', () => {
    expect(isValidPassword('Ab1')).toBe(false)
  })

  it('rejects passwords without an uppercase letter', () => {
    expect(isValidPassword('password1')).toBe(false)
  })

  it('rejects passwords without a lowercase letter', () => {
    expect(isValidPassword('PASSWORD1')).toBe(false)
  })

  it('rejects passwords without a digit', () => {
    expect(isValidPassword('Password')).toBe(false)
  })
})

describe('isValidDob', () => {
  it('accepts valid MM-DD-YYYY dates', () => {
    expect(isValidDob('01-15-2000')).toBe(true)
    expect(isValidDob('12-31-1999')).toBe(true)
  })

  it('rejects invalid month values', () => {
    expect(isValidDob('13-01-2000')).toBe(false)
    expect(isValidDob('00-01-2000')).toBe(false)
  })

  it('rejects invalid day values', () => {
    expect(isValidDob('01-00-2000')).toBe(false)
    expect(isValidDob('01-32-2000')).toBe(false)
  })

  it('rejects wrong format', () => {
    expect(isValidDob('2000-01-15')).toBe(false)
    expect(isValidDob('15/01/2000')).toBe(false)
    expect(isValidDob('')).toBe(false)
  })

  it('rejects non-existent dates like Feb 30', () => {
    expect(isValidDob('02-30-2000')).toBe(false)
  })
})
