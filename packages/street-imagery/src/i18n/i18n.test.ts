import { describe, expect, test } from 'bun:test'
import { formatDate, formatMonth, mapillaryValueName } from './index'

describe('mapillaryValueName', () => {
  test('English: readable form of the value', () => {
    expect(mapillaryValueName('regulatory--turn-right-ahead--g1', 'en')).toBe(
      'Regulatory · Turn right ahead',
    )
  })

  test('German: curated name, speed limits by rule, category fallback', () => {
    expect(mapillaryValueName('regulatory--bicycles-only--g1', 'de')).toBe('Radweg')
    expect(mapillaryValueName('object--traffic-light--cyclists', 'de')).toBe('Ampel für Radverkehr')
    expect(mapillaryValueName('regulatory--maximum-speed-limit-30--g1', 'de')).toBe(
      'Höchstgeschwindigkeit 30',
    )
    expect(mapillaryValueName('warning--koala-crossing--g1', 'de')).toBe(
      'Gefahrzeichen · Koala crossing',
    )
  })
})

describe('dates', () => {
  const date = new Date(2026, 7, 2, 12)

  test('default date and month per locale', () => {
    expect(formatDate(date, 'en')).toBe('Aug 2, 2026')
    expect(formatDate(date, 'de')).toBe('2. Aug. 2026')
    expect(formatMonth(date, 'en')).toBe('Aug 2026')
    expect(formatMonth(date, 'de')).toBe('Aug 2026')
  })
})
