import {
  dateRangeToSliderPositions,
  dateSliderBins,
  dateSliderPosition,
  formatDate,
  isIsoDate,
  parseIsoDateStartMs,
  sliderPositionsToDateRange,
  yearsAgoMs,
  type DateRange,
  type DateSliderPositions,
} from '@osm-editor-kit/street-imagery'
import { useRef, useState } from 'react'
import { useStreetImageryI18n } from '../i18n/StreetImageryLocaleProvider'

/** A fixed date to show in the chart, e.g. the start of a project or of a survey. */
export type PhotoDateMarker = {
  /** A day as `YYYY-MM-DD`, or a time (ms). */
  date: string | number
  label: string
  /** CSS color of line and label. Default red. */
  color?: string
}

export type PhotoDateRangeFilterProps = {
  /** The chosen range, days as `YYYY-MM-DD`. No `from` and no `to`: all dates. */
  value: DateRange
  /** Called when a handle is released, a year label is clicked or a date input changes. */
  onChange: (range: DateRange) => void
  /**
   * Capture times (ms) of the photos to show as marks above the slider, usually all photos in
   * view before the date filter. Without it there are no marks.
   */
  capturedAt?: Iterable<number | null | undefined>
  /** Lines with a label at these ages in years; a click on a label shows that many years. */
  yearLines?: readonly number[]
  /** Its line is red; added to `yearLines` when it is not one of them. */
  recommendedMaxAgeYears?: number
  markers?: readonly PhotoDateMarker[]
  /** Years the slider spans. Default 10. */
  maxYears?: number
  /** Reference time (ms). Default: the time of the first render. */
  now?: number
  /**
   * The two date inputs for exact days, in sync with the slider: folded away (default), open,
   * or left out.
   */
  dateInputs?: 'collapsed' | 'open' | 'none'
  /**
   * The "All dates" action next to the chosen range, which removes both limits. Default true;
   * without it the user moves both handles to the ends.
   */
  allDatesAction?: boolean
  className?: string
}

const DEFAULT_YEAR_LINES = [1, 2, 3, 4] as const
const BINS = 60
const STEP = 0.001
const CHART_HEIGHT_PX = 36
const RED = '#dc2626'

// The native handles are 16px wide; their centers travel between 8px from each end. The chart
// has the same inset (`mx-2`), so a line at 40% sits where a handle at 40% points.
const HANDLE_CLASS =
  'pointer-events-none absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none bg-transparent focus:outline-none ' +
  '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:bg-transparent ' +
  '[&::-moz-range-track]:bg-transparent ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-slate-800 [&::-webkit-slider-thumb]:shadow ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-slate-800 [&::-moz-range-thumb]:shadow ' +
  'focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-sky-500 focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-sky-500'

const percent = (position: number): string => `${position * 100}%`

/**
 * Date filter for photos after iD's photo age slider: one slider with two handles on a scale that
 * gives recent years more room, marks that show how many photos there are at each time, lines at
 * whole years, and optional fixed markers. Controlled: `value` in, `onChange` out.
 */
export const PhotoDateRangeFilter = ({
  value,
  onChange,
  capturedAt,
  yearLines = DEFAULT_YEAR_LINES,
  recommendedMaxAgeYears,
  markers = [],
  maxYears,
  now: nowProp,
  dateInputs = 'collapsed',
  className,
  allDatesAction = true,
}: PhotoDateRangeFilterProps) => {
  const { locale, messages } = useStreetImageryI18n()
  const text = messages.dateFilter
  const [startNow] = useState(() => Date.now())
  const now = nowProp ?? startNow
  const scale = { now, maxYears }

  // While a handle is dragged the slider shows the dragged positions; `onChange` runs on release.
  const [dragged, setDragged] = useState<DateSliderPositions | null>(null)
  const fromInput = useRef<HTMLInputElement>(null)
  const toInput = useRef<HTMLInputElement>(null)

  const positions = dragged ?? dateRangeToSliderPositions(value, scale)
  const shownRange = dragged ? sliderPositionsToDateRange(dragged, scale) : value

  const readPositions = (moved: 'from' | 'to'): DateSliderPositions => {
    const from = Number(fromInput.current?.value ?? positions.from)
    const to = Number(toInput.current?.value ?? positions.to)
    // The moved handle stops at the other one.
    return moved === 'from' ? { from: Math.min(from, to), to } : { from, to: Math.max(from, to) }
  }

  // React's `onChange` runs on every move; the native `change` only when the handle is released.
  const commitOnRelease = (moved: 'from' | 'to') => (input: HTMLInputElement | null) => {
    if (!input) {
      return undefined
    }
    const commit = () => {
      setDragged(null)
      // Only the moved side changes: the other day would shift by the slider's step otherwise.
      const next = sliderPositionsToDateRange(readPositions(moved), scale)
      const other = moved === 'from' ? 'to' : 'from'
      onChange({ ...next, [other]: value[other] })
    }
    input.addEventListener('change', commit)
    return () => {
      input.removeEventListener('change', commit)
    }
  }

  // React also sends the release (`change`) here, after the commit above; that must not start a
  // new drag.
  const trackDrag = (moved: 'from' | 'to', event: Event) => {
    if (event.type === 'input') {
      setDragged(readPositions(moved))
    }
  }

  const bins = capturedAt ? dateSliderBins(capturedAt, scale, BINS) : []
  const maxCount = Math.max(1, ...bins)

  const years = [
    ...new Set(recommendedMaxAgeYears ? [...yearLines, recommendedMaxAgeYears] : yearLines),
  ]
    .map((count) => ({ count, position: dateSliderPosition(yearsAgoMs(count, now), scale) }))
    .filter(({ position }) => position > 0 && position < 1)

  const shownMarkers = markers
    .map((marker) => {
      const time = typeof marker.date === 'number' ? marker.date : parseIsoDateStartMs(marker.date)
      return { ...marker, position: dateSliderPosition(time, scale) }
    })
    .filter(({ position }) => position > 0 && position < 1)

  const day = (isoDate: string): string => formatDate(parseIsoDateStartMs(isoDate), locale)
  const rangeLabel =
    shownRange.from && shownRange.to
      ? text.between(day(shownRange.from), day(shownRange.to))
      : shownRange.from
        ? text.since(day(shownRange.from))
        : shownRange.to
          ? text.until(day(shownRange.to))
          : text.allDates

  const setYears = (count: number) => {
    onChange({ from: new Date(yearsAgoMs(count, now)).toISOString().slice(0, 10) })
  }

  const setDay = (key: 'from' | 'to', input: string) => {
    if (input === '') {
      onChange({ ...value, [key]: undefined })
    } else if (isIsoDate(input)) {
      onChange({ ...value, [key]: input })
    }
  }

  const isAllDates = !shownRange.from && !shownRange.to

  return (
    <div className={className}>
      <div className="mx-2">
        {/* Room for the marker labels above the chart. */}
        <div
          className="relative"
          style={{ height: CHART_HEIGHT_PX, marginTop: shownMarkers.length > 0 ? 14 : 0 }}
        >
          <div aria-hidden className="absolute inset-0 flex items-end">
            {bins.map((count, index) => {
              const start = index / BINS
              const inRange = start + 1 / BINS > positions.from && start < positions.to
              return (
                <div
                  className={`flex-1 rounded-t-[1px] ${inRange ? 'bg-slate-500' : 'bg-slate-300'}`}
                  // oxlint-disable-next-line react/no-array-index-key -- fixed parts of the scale
                  key={index}
                  // Logarithmic: a few photos stay visible next to thousands. The first bar holds
                  // everything older than the slider spans and is often by far the largest.
                  style={{
                    height:
                      count === 0
                        ? 0
                        : Math.max(2, (Math.log1p(count) / Math.log1p(maxCount)) * CHART_HEIGHT_PX),
                  }}
                  title={count > 0 ? text.photoCount(count) : undefined}
                />
              )
            })}
          </div>
          {years.map(({ count, position }) => (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2"
              key={count}
              style={{
                left: percent(position),
                backgroundColor: count === recommendedMaxAgeYears ? RED : 'rgb(148 163 184 / 0.7)',
              }}
            />
          ))}
          {shownMarkers.map((marker) => (
            <div
              className="pointer-events-none absolute inset-y-0 w-0 border-l-2 border-dashed"
              key={`${marker.date}-${marker.label}`}
              style={{ left: percent(marker.position), borderColor: marker.color ?? RED }}
            >
              <span
                className="absolute -top-3.5 -translate-x-1/2 text-[10px] leading-none whitespace-nowrap"
                style={{ color: marker.color ?? RED }}
              >
                {marker.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative h-4">
        <div className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200">
          <div
            className="absolute inset-y-0 rounded-full bg-slate-700"
            style={{
              left: percent(positions.from),
              right: percent(1 - positions.to),
            }}
          />
        </div>
        <input
          aria-label={text.fromHandle}
          aria-valuetext={shownRange.from ? day(shownRange.from) : text.allDates}
          className={HANDLE_CLASS}
          max={1}
          min={0}
          onChange={(event) => {
            trackDrag('from', event.nativeEvent)
          }}
          ref={(input) => {
            fromInput.current = input
            return commitOnRelease('from')(input)
          }}
          step={STEP}
          type="range"
          value={positions.from}
        />
        <input
          aria-label={text.toHandle}
          aria-valuetext={shownRange.to ? day(shownRange.to) : text.allDates}
          className={HANDLE_CLASS}
          max={1}
          min={0}
          onChange={(event) => {
            trackDrag('to', event.nativeEvent)
          }}
          ref={(input) => {
            toInput.current = input
            return commitOnRelease('to')(input)
          }}
          step={STEP}
          type="range"
          value={positions.to}
        />
      </div>

      <div className="relative mx-2 h-4">
        {years.map(({ count, position }) => (
          <button
            className={`absolute top-0 -translate-x-1/2 rounded px-0.5 text-[10px] leading-4 whitespace-nowrap hover:underline ${
              count === recommendedMaxAgeYears
                ? 'font-semibold text-red-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            key={count}
            onClick={() => {
              setYears(count)
            }}
            style={{ left: percent(position) }}
            title={
              count === recommendedMaxAgeYears
                ? text.recommendedMaxAge(count)
                : text.lastYears(count)
            }
            type="button"
          >
            {text.yearsShort(count)}
          </button>
        ))}
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-slate-700">{rangeLabel}</span>
        {isAllDates || !allDatesAction ? null : (
          <button
            className="shrink-0 font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            onClick={() => {
              onChange({})
            }}
            type="button"
          >
            {text.allDates}
          </button>
        )}
      </div>

      {dateInputs === 'none' ? null : (
        <details className="mt-1 text-xs text-slate-600" open={dateInputs === 'open' || undefined}>
          <summary className="cursor-pointer select-none hover:text-slate-900">
            {text.exactDates}
          </summary>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(['from', 'to'] as const).map((key) => (
              <label className="flex flex-col gap-1" key={key}>
                {text[key]}
                <input
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
                  onChange={(event) => {
                    setDay(key, event.target.value)
                  }}
                  type="date"
                  value={value[key] ?? ''}
                />
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
