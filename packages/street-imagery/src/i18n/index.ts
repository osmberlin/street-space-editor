import { format, formatDistanceStrict, type Locale } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { MAPILLARY_CATEGORY_NAMES_DE, MAPILLARY_VALUE_NAMES_DE } from './mapillaryValueNamesDe'

/** Languages the street-imagery packages ship texts and date formats for. */
export const STREET_IMAGERY_LOCALES = ['en', 'de'] as const
export type StreetImageryLocale = (typeof STREET_IMAGERY_LOCALES)[number]
export const DEFAULT_STREET_IMAGERY_LOCALE: StreetImageryLocale = 'en'

const DATE_FNS_LOCALES: Record<StreetImageryLocale, Locale> = { en: enUS, de }

export const dateFnsLocale = (locale: StreetImageryLocale): Locale => DATE_FNS_LOCALES[locale]

/** The locale's default date: "Aug 2, 2026" / "02.08.2026". */
export const formatDate = (timestamp: number | Date, locale: StreetImageryLocale): string =>
  format(timestamp, 'PP', { locale: dateFnsLocale(locale) })

/** Month and year: "Aug 2026". */
export const formatMonth = (timestamp: number | Date, locale: StreetImageryLocale): string =>
  format(timestamp, 'LLL yyyy', { locale: dateFnsLocale(locale) })

/** "2 months ago" / "vor 2 Monaten". */
export const formatRelativeDate = (
  timestamp: number | Date,
  locale: StreetImageryLocale,
  now: number | Date = Date.now(),
): string =>
  formatDistanceStrict(timestamp, now, { addSuffix: true, locale: dateFnsLocale(locale) })

/**
 * Date and time as the camera's clock showed it, with the UTC offset: "Mar 8, 2025, 3:40 PM
 * (+01:00)". Takes an ISO time with offset (`2025-03-08T15:40:35+01:00`); `null` when it has none.
 */
export const formatLocalDateTime = (
  isoWithOffset: string,
  locale: StreetImageryLocale,
): string | null => {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.exec(
    isoWithOffset,
  )
  const wallClock = match?.[1]
  if (!wallClock) {
    return null
  }
  // Without the offset the time parses as local, so it formats as the camera's wall clock.
  const offset = match[2] === 'Z' ? '+00:00' : match[2]
  return `${format(new Date(wallClock), 'PPp', { locale: dateFnsLocale(locale) })} (${offset})`
}

/** Two lines for a tooltip: the full date, and how long ago that is. */
export const formatDateTooltip = (
  timestamp: number | Date,
  locale: StreetImageryLocale,
  now?: number | Date,
): string => `${formatDate(timestamp, locale)}\n${formatRelativeDate(timestamp, locale, now)}`

/** Readable name of a Mapillary value: `regulatory--no-stopping--g1` → "Regulatory · No stopping". */
export const humanizeMapillaryValue = (value: string): string =>
  value
    .replace(/--[a-z]\d+$/i, '')
    .split('--')
    .filter((part) => part.length > 0)
    .map((part) => part.replaceAll('-', ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' · ')

/** Speed-limit families with the limit as last number: `maximum-speed-limit-30`. */
const SPEED_NAMES_DE: [RegExp, string][] = [
  [/^regulatory--maximum-speed-limit(?:-led)?-(\d+)$/, 'Höchstgeschwindigkeit'],
  [/^regulatory--end-of-maximum-speed-limit-(\d+)$/, 'Ende Höchstgeschwindigkeit'],
  [/^complementary--maximum-speed-limit-(\d+)$/, 'Höchstgeschwindigkeit'],
  [/^(?:regulatory|information)--minimum-speed-(\d+)$/, 'Mindestgeschwindigkeit'],
  [/^information--end-of-minimum-speed-(\d+)$/, 'Ende Mindestgeschwindigkeit'],
  [/^regulatory--advisory-maximum-speed-limit-(\d+)$/, 'Richtgeschwindigkeit'],
]

/**
 * Name of a Mapillary value in the locale. German has a curated list (signs found in Germany,
 * all objects and markings); other values get the German category and Mapillary's English name:
 * "Gefahrzeichen · Koala crossing".
 */
export const mapillaryValueName = (value: string, locale: StreetImageryLocale): string => {
  if (locale !== 'de') {
    return humanizeMapillaryValue(value)
  }
  const key = value.replace(/--[a-z]\d+$/i, '')
  const known = MAPILLARY_VALUE_NAMES_DE[key]
  if (known) {
    return known
  }
  for (const [pattern, name] of SPEED_NAMES_DE) {
    const limit = pattern.exec(key)?.[1]
    if (limit) {
      return `${name} ${limit}`
    }
  }
  const [category = '', ...rest] = key.split('--')
  const categoryName = MAPILLARY_CATEGORY_NAMES_DE[category]
  return categoryName
    ? `${categoryName} · ${humanizeMapillaryValue(rest.join('--'))}`
    : humanizeMapillaryValue(value)
}
