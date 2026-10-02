/**
 * Age colors of imagery relative to a cutoff date (from the iD Radnetz fork, feature 18).
 * Older than the cutoff = `outdated`. The time from the cutoff to now is split into three equal
 * parts: `old`, `mid`, `new`. The bands follow the cutoff, so they fit any "from" filter.
 */
export type AgeBand = 'outdated' | 'old' | 'mid' | 'new'

export const AGE_BANDS: AgeBand[] = ['outdated', 'old', 'mid', 'new']

/** Default colors: red, orange, yellow, green. */
export const AGE_BAND_COLORS: Record<AgeBand, string> = {
  outdated: '#dc2626',
  old: '#f97316',
  mid: '#eab308',
  new: '#16a34a',
}

/** Band of a capture time (ms); photos without a date count as outdated. */
export const ageBand = (
  capturedAt: number | null | undefined,
  cutoff: number,
  now: number,
): AgeBand => {
  if (capturedAt == null || Number.isNaN(capturedAt) || capturedAt < cutoff) {
    return 'outdated'
  }
  const span = now - cutoff
  if (span <= 0) {
    return 'new'
  }
  const fraction = (capturedAt - cutoff) / span
  if (fraction < 1 / 3) {
    return 'old'
  }
  return fraction < 2 / 3 ? 'mid' : 'new'
}

/** Start (ms) of each non-outdated band, for legends. */
export const ageBandStarts = (
  cutoff: number,
  now: number,
): Record<Exclude<AgeBand, 'outdated'>, number> => {
  const third = Math.max(0, now - cutoff) / 3
  return { old: cutoff, mid: cutoff + third, new: cutoff + 2 * third }
}

/**
 * MapLibre `step` expression for a color by the feature's `capturedAt` property (ms), e.g. for
 * `circle-color`. Typed loosely so the core package needs no MapLibre types.
 */
export const ageBandColorExpression = (
  cutoff: number,
  now: number,
  colors: Record<AgeBand, string> = AGE_BAND_COLORS,
  property = 'capturedAt',
): unknown[] => {
  const starts = ageBandStarts(cutoff, now)
  return [
    'step',
    ['coalesce', ['get', property], 0],
    colors.outdated,
    starts.old,
    colors.old,
    starts.mid,
    colors.mid,
    starts.new,
    colors.new,
  ]
}
