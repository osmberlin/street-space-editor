import type { DateRange } from './searchFilters'
import { parseIsoDateEndMs, parseIsoDateStartMs } from './searchFilters'

/**
 * Scale of the date slider, after iD's photo age slider: a position from 0 (oldest) to 1 (now).
 * It is not linear: recent years take more room than old ones, because that is where most
 * photos are and where a mapper needs the finer control.
 */
export type DateSliderScale = {
  /** Reference time (ms), the right end of the slider. */
  now: number
  /** Years the slider spans; everything older sits at the left end. Default 10, as in iD. */
  maxYears?: number
}

export const DATE_SLIDER_MAX_YEARS = 10

const YEAR_MS = 365.25 * 86_400_000
/** iD's exponent; larger values give recent years even more room. */
const EXPONENT = 1.45

const spanMs = ({ maxYears = DATE_SLIDER_MAX_YEARS }: DateSliderScale): number => maxYears * YEAR_MS

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Position (0 oldest … 1 now) of a time (ms). Times outside the span sit at the ends. */
export const dateSliderPosition = (time: number, scale: DateSliderScale): number =>
  1 - clamp01((scale.now - time) / spanMs(scale)) ** (1 / EXPONENT)

/** Time (ms) of a position (0 oldest … 1 now). */
export const dateSliderTime = (position: number, scale: DateSliderScale): number =>
  scale.now - (1 - clamp01(position)) ** EXPONENT * spanMs(scale)

// Rounded: the way through the scale can leave a day's start a fraction of a millisecond early.
const isoDay = (time: number): string => new Date(Math.round(time)).toISOString().slice(0, 10)

export type DateSliderPositions = { from: number; to: number }

/** Handle positions of a date range; a missing `from` is the left end, a missing `to` the right. */
export const dateRangeToSliderPositions = (
  range: DateRange | undefined,
  scale: DateSliderScale,
): DateSliderPositions => {
  const from = range?.from ? dateSliderPosition(parseIsoDateStartMs(range.from), scale) : 0
  const to = range?.to ? dateSliderPosition(parseIsoDateEndMs(range.to), scale) : 1
  return { from: Math.min(from, to), to: Math.max(from, to) }
}

/**
 * Date range of two handle positions. A handle at its end means "no limit": the left end shows
 * photos of any age, also those older than the slider spans.
 */
export const sliderPositionsToDateRange = (
  positions: DateSliderPositions,
  scale: DateSliderScale,
): DateRange => {
  const from = Math.min(positions.from, positions.to)
  const to = Math.max(positions.from, positions.to)
  const range: DateRange = {}
  if (from > 0) {
    range.from = isoDay(dateSliderTime(from, scale))
  }
  if (to < 1) {
    range.to = isoDay(dateSliderTime(to, scale))
  }
  return range
}

/**
 * How many of the times (ms) fall into each of `bins` equal parts of the slider, oldest first,
 * for the marks that show where photos are. Entries without a time are skipped.
 */
export const dateSliderBins = (
  times: Iterable<number | null | undefined>,
  scale: DateSliderScale,
  bins = 60,
): number[] => {
  const counts = Array.from({ length: bins }, () => 0)
  for (const time of times) {
    if (time == null || Number.isNaN(time)) {
      continue
    }
    const index = Math.min(bins - 1, Math.floor(dateSliderPosition(time, scale) * bins))
    counts[index]! += 1
  }
  return counts
}
