import { describe, it, expect } from 'vitest'
import { formatDecimalHours, minutesToTime, normalizeTime, timeToMinutes } from '../time'

describe('normalizeTime', () => {
  it('tronque les secondes', () => {
    expect(normalizeTime('07:30:00')).toBe('07:30')
  })

  it('laisse HH:MM inchangé', () => {
    expect(normalizeTime('08:00')).toBe('08:00')
  })
})

describe('timeToMinutes / minutesToTime', () => {
  it('convertit dans les deux sens', () => {
    expect(timeToMinutes('08:30')).toBe(510)
    expect(minutesToTime(510)).toBe('08:30')
  })
})

describe('formatDecimalHours', () => {
  it('convertit une demi-heure décimale', () => {
    expect(formatDecimalHours(7.5)).toBe('7h30')
  })

  it('omet les minutes pour une valeur entière', () => {
    expect(formatDecimalHours(7)).toBe('7h')
  })

  it('affiche les minutes seules sous une heure', () => {
    expect(formatDecimalHours(0.5)).toBe('30min')
  })

  it('gère le quart d’heure', () => {
    expect(formatDecimalHours(7.25)).toBe('7h15')
  })

  it('zéro renvoie 0h', () => {
    expect(formatDecimalHours(0)).toBe('0h')
  })

  it('arrondit à la minute la plus proche', () => {
    expect(formatDecimalHours(7.499 / 1)).toBe('7h30')
    expect(formatDecimalHours(2.008)).toBe('2h')
  })

  it('gère le report quand l’arrondi atteint 60 min', () => {
    expect(formatDecimalHours(1.999)).toBe('2h')
  })

  it('gère les valeurs négatives (écart)', () => {
    expect(formatDecimalHours(-1.5)).toBe('-1h30')
  })

  it('renvoie un tiret pour une valeur non finie', () => {
    expect(formatDecimalHours(Number.NaN)).toBe('-')
  })
})
