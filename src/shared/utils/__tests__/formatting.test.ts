import { describe, it, expect } from 'vitest'
import { formatFcfa, formatRate } from '../formatting'

// Intl.NumberFormat with the "fr" locale uses U+00A0 (NBSP) or U+202F
// (NARROW NO-BREAK SPACE) between thousands groups and before the currency
// symbol. Normalise both to a regular space so assertions stay readable
// regardless of the Node/ICU version.
const NBSP_PATTERN = new RegExp('[\\u00A0\\u202F]', 'g')
const stripNbsp = (value: string): string => value.replace(NBSP_PATTERN, ' ')

describe('formatFcfa', () => {
  it('should format zero correctly', () => {
    expect(stripNbsp(formatFcfa(0))).toBe('0 FCFA')
  })

  it('should format thousands with space separator', () => {
    expect(stripNbsp(formatFcfa(1000))).toBe('1 000 FCFA')
  })

  it('should format large numbers correctly', () => {
    expect(stripNbsp(formatFcfa(1000000))).toBe('1 000 000 FCFA')
    expect(stripNbsp(formatFcfa(235000))).toBe('235 000 FCFA')
  })

  it('should handle decimal numbers by rounding', () => {
    expect(stripNbsp(formatFcfa(1234.56))).toBe('1 235 FCFA')
  })
})

describe('formatRate', () => {
  it('should format percentage and round to nearest integer', () => {
    expect(formatRate(87.3)).toBe('87%')
    expect(formatRate(87.8)).toBe('88%')
  })

  it('should handle zero', () => {
    expect(formatRate(0)).toBe('0%')
  })

  it('should handle 100', () => {
    expect(formatRate(100)).toBe('100%')
  })

  it('should round half values correctly', () => {
    expect(formatRate(87.5)).toBe('88%')
    expect(formatRate(86.5)).toBe('87%')
  })
})
