import { describe, expect, test } from 'bun:test'
import { yearsAgoMs } from '../map/ageSteps'
import {
  dateRangeToSliderPositions,
  dateSliderBins,
  dateSliderPosition,
  dateSliderTime,
  sliderPositionsToDateRange,
} from './dateSlider'

const now = Date.UTC(2026, 9, 5)
const scale = { now }

describe('date slider scale', () => {
  test('runs from the oldest time at 0 to now at 1', () => {
    expect(dateSliderPosition(now, scale)).toBe(1)
    expect(dateSliderPosition(yearsAgoMs(10, now) - 86_400_000, scale)).toBe(0)
    expect(dateSliderPosition(yearsAgoMs(30, now), scale)).toBe(0)
    expect(dateSliderPosition(now + 86_400_000, scale)).toBe(1)
  })

  test('gives recent years more room than old ones', () => {
    const position = (years: number) => dateSliderPosition(yearsAgoMs(years, now), scale)
    expect(position(1) - position(2)).toBeGreaterThan(position(8) - position(9))
    // Two years back is about a third from the right, four years about half.
    expect(position(2)).toBeCloseTo(0.67, 1)
    expect(position(4)).toBeCloseTo(0.47, 1)
  })

  test('time and position are inverse', () => {
    for (const years of [0.5, 1, 2, 4, 9]) {
      const time = now - years * 365 * 86_400_000
      expect(dateSliderTime(dateSliderPosition(time, scale), scale)).toBeCloseTo(time, -3)
    }
  })

  test('maxYears changes the span', () => {
    expect(dateSliderPosition(yearsAgoMs(5, now), { now, maxYears: 5 })).toBeCloseTo(0, 2)
  })
})

describe('date range and handle positions', () => {
  test('no range is both ends', () => {
    expect(dateRangeToSliderPositions(undefined, scale)).toEqual({ from: 0, to: 1 })
    expect(dateRangeToSliderPositions({}, scale)).toEqual({ from: 0, to: 1 })
  })

  test('handles at the ends mean no limit', () => {
    expect(sliderPositionsToDateRange({ from: 0, to: 1 }, scale)).toEqual({})
    expect(sliderPositionsToDateRange({ from: 0.5, to: 1 }, scale).to).toBeUndefined()
  })

  test('a day survives the way to positions and back', () => {
    const range = { from: '2024-10-05', to: '2025-06-30' }
    expect(sliderPositionsToDateRange(dateRangeToSliderPositions(range, scale), scale)).toEqual(
      range,
    )
  })

  test('swapped handles still give from before to', () => {
    const range = sliderPositionsToDateRange({ from: 0.9, to: 0.4 }, scale)
    expect(range.from! < range.to!).toBe(true)
  })
})

describe('dateSliderBins', () => {
  test('counts times per part and skips missing ones', () => {
    const bins = dateSliderBins(
      [now, now, yearsAgoMs(20, now), null, undefined, Number.NaN],
      scale,
      4,
    )
    expect(bins).toEqual([1, 0, 0, 2])
  })
})
