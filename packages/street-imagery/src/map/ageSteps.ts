/**
 * Photo and feature age as fixed steps from a time, e.g. "older than 4 years", "2–4 years",
 * "newer than 2 years". The default is the TILDA palette with 4 and 2 years; both the thresholds
 * (years, or exact times for a project that needs them) and the colors are options.
 *
 * Use `ageBand*` (`ageBands.ts`) instead when the steps should follow a "from" filter.
 */

/** Photos older than this are not useful for most mapping; hosts can hide them by default. */
export const MAX_USEFUL_AGE_YEARS = 4

/** TILDA age palette: green, yellow, orange; grey for no date. */
export const AGE_STEP_COLORS = {
  current: '#05CB63',
  mid: '#FFC01B',
  old: '#F77E5E',
  unknown: '#9ca3af',
} as const

/** Time (ms) `years` calendar years before `now` (UTC). */
export const yearsAgoMs = (years: number, now: number = Date.now()): number => {
  const date = new Date(now)
  date.setUTCFullYear(date.getUTCFullYear() - years)
  return date.getTime()
}

export type AgeStep = {
  id: string
  color: string
  /** Captured at or after this time (ms); `null`: no lower bound. */
  from: number | null
  /** Captured before this time (ms); `null`: no upper bound. */
  to: number | null
}

export type AgeStepsOptions = {
  /** Reference time. Default: now. Keep it fixed for the page's lifetime so paint stays stable. */
  now?: number
  /** Years back where each step after the oldest starts, oldest first. Default `[4, 2]`. */
  years?: readonly number[]
  /** Exact times (ms) where each step after the oldest starts, oldest first; wins over `years`. */
  starts?: readonly number[]
  /** One color per step, oldest first. Default orange, yellow, green. */
  colors?: readonly string[]
  /** One id per step, oldest first. Default `old`, `mid`, `current` (for the default three). */
  ids?: readonly string[]
}

const DEFAULT_YEARS = [MAX_USEFUL_AGE_YEARS, 2] as const
const DEFAULT_COLORS = [AGE_STEP_COLORS.old, AGE_STEP_COLORS.mid, AGE_STEP_COLORS.current] as const
const DEFAULT_IDS = ['old', 'mid', 'current'] as const

/**
 * The steps from oldest to newest. N start times give N + 1 steps: the oldest has no lower bound,
 * the newest no upper bound.
 */
export const createAgeSteps = ({
  now = Date.now(),
  years = DEFAULT_YEARS,
  starts,
  colors,
  ids,
}: AgeStepsOptions = {}): AgeStep[] => {
  // Sorted and without duplicates: MapLibre's `step` needs strictly ascending stops.
  const bounds = [...new Set(starts ?? years.map((count) => yearsAgoMs(count, now)))].sort(
    (a, b) => a - b,
  )
  const defaults = bounds.length === DEFAULT_YEARS.length
  return Array.from({ length: bounds.length + 1 }, (_, index) => ({
    id: ids?.[index] ?? (defaults ? DEFAULT_IDS[index] : undefined) ?? `step-${index}`,
    color:
      colors?.[index] ?? (defaults ? DEFAULT_COLORS[index] : undefined) ?? AGE_STEP_COLORS.unknown,
    from: index === 0 ? null : (bounds[index - 1] ?? null),
    to: bounds[index] ?? null,
  }))
}

/** Step of a capture time (ms); `null` for photos without a date. */
export const ageStepOf = (
  steps: readonly AgeStep[],
  capturedAt: number | null | undefined,
): AgeStep | null => {
  if (capturedAt == null || Number.isNaN(capturedAt)) {
    return null
  }
  return (
    steps.find(
      (step) =>
        (step.from === null || capturedAt >= step.from) &&
        (step.to === null || capturedAt < step.to),
    ) ?? null
  )
}

/** Number of items per step id; `unknown` counts the ones without a date. */
export const countByAgeStep = <T>(
  items: readonly T[],
  capturedAt: (item: T) => number | null | undefined,
  steps: readonly AgeStep[],
): Record<string, number> => {
  const counts: Record<string, number> = {
    unknown: 0,
    ...Object.fromEntries(steps.map((step) => [step.id, 0])),
  }
  for (const item of items) {
    const id = ageStepOf(steps, capturedAt(item))?.id ?? 'unknown'
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

/**
 * MapLibre color expression by the feature's time property (ms): `capturedAt` for photos,
 * `lastSeenAt` for map features. Without a value: `unknownColor`.
 */
export const ageStepColorExpression = (
  steps: readonly AgeStep[],
  { property = 'capturedAt', unknownColor = AGE_STEP_COLORS.unknown } = {},
): unknown[] => {
  const [oldest, ...rest] = steps
  return [
    'case',
    ['==', ['get', property], null],
    unknownColor,
    [
      'step',
      ['get', property],
      oldest?.color ?? unknownColor,
      ...rest.flatMap((step) => [step.from ?? 0, step.color]),
    ],
  ]
}

/** MapLibre boolean expression: the feature's time property is in the step (for legend counts). */
export const ageStepMatchExpression = (step: AgeStep, property = 'capturedAt'): unknown[] => [
  'all',
  ...(step.from === null ? [] : [['>=', ['get', property], step.from]]),
  ...(step.to === null ? [] : [['<', ['get', property], step.to]]),
]
