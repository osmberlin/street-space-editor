import { describe, expect, it } from 'bun:test'
import {
  AGE_STEP_COLORS,
  ageStepColorExpression,
  ageStepMatchExpression,
  ageStepOf,
  countByAgeStep,
  createAgeSteps,
  yearsAgoMs,
} from './ageSteps'

const NOW = Date.UTC(2026, 9, 5)

describe('ageSteps', () => {
  it('defaults to older than 4 years, 2–4 years, newer than 2 years', () => {
    const steps = createAgeSteps({ now: NOW })
    expect(steps.map((step) => step.id)).toEqual(['old', 'mid', 'current'])
    expect(steps.map((step) => step.color)).toEqual([
      AGE_STEP_COLORS.old,
      AGE_STEP_COLORS.mid,
      AGE_STEP_COLORS.current,
    ])
    expect(steps[0]).toMatchObject({ from: null, to: yearsAgoMs(4, NOW) })
    expect(steps[2]).toMatchObject({ from: yearsAgoMs(2, NOW), to: null })
  })

  it('takes years, exact times and own colors', () => {
    const byYears = createAgeSteps({ now: NOW, years: [1] })
    expect(byYears).toHaveLength(2)
    // Unsorted and repeated start times still give ascending steps.
    expect(createAgeSteps({ starts: [200, 100, 200] }).map((step) => step.to)).toEqual([
      100,
      200,
      null,
    ])
    const exact = Date.UTC(2023, 0, 1)
    const byTime = createAgeSteps({ starts: [exact], colors: ['#111', '#222'], ids: ['a', 'b'] })
    expect(byTime).toEqual([
      { id: 'a', color: '#111', from: null, to: exact },
      { id: 'b', color: '#222', from: exact, to: null },
    ])
  })

  it('finds the step of a capture time and counts', () => {
    const steps = createAgeSteps({ now: NOW })
    expect(ageStepOf(steps, Date.UTC(2020, 0, 1))?.id).toBe('old')
    expect(ageStepOf(steps, Date.UTC(2024, 0, 1))?.id).toBe('mid')
    expect(ageStepOf(steps, Date.UTC(2026, 0, 1))?.id).toBe('current')
    expect(ageStepOf(steps, null)).toBeNull()
    const counts = countByAgeStep(
      [Date.UTC(2020, 0, 1), Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1), null],
      (time) => time,
      steps,
    )
    expect(counts).toEqual({ unknown: 1, old: 1, mid: 0, current: 2 })
  })

  it('builds the paint and legend expressions', () => {
    const steps = createAgeSteps({ now: NOW })
    expect(ageStepColorExpression(steps)).toEqual([
      'case',
      ['==', ['get', 'capturedAt'], null],
      AGE_STEP_COLORS.unknown,
      [
        'step',
        ['get', 'capturedAt'],
        AGE_STEP_COLORS.old,
        yearsAgoMs(4, NOW),
        AGE_STEP_COLORS.mid,
        yearsAgoMs(2, NOW),
        AGE_STEP_COLORS.current,
      ],
    ])
    expect(ageStepMatchExpression(steps[1]!, 'lastSeenAt')).toEqual([
      'all',
      ['>=', ['get', 'lastSeenAt'], yearsAgoMs(4, NOW)],
      ['<', ['get', 'lastSeenAt'], yearsAgoMs(2, NOW)],
    ])
  })
})
