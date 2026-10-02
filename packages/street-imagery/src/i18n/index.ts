import { format, formatDistanceStrict, type Locale } from 'date-fns'
import { de, enUS } from 'date-fns/locale'

/** Languages the street-imagery packages ship texts and date formats for. */
export const STREET_IMAGERY_LOCALES = ['en', 'de'] as const
export type StreetImageryLocale = (typeof STREET_IMAGERY_LOCALES)[number]
export const DEFAULT_STREET_IMAGERY_LOCALE: StreetImageryLocale = 'en'

const DATE_FNS_LOCALES: Record<StreetImageryLocale, Locale> = { en: enUS, de }

export const dateFnsLocale = (locale: StreetImageryLocale): Locale => DATE_FNS_LOCALES[locale]

/** The locale's default date: "Aug 2, 2026" / "02.08.2026". */
export const formatDate = (timestamp: number | Date, locale: StreetImageryLocale): string =>
  format(timestamp, 'PP', { locale: dateFnsLocale(locale) })

/** Month and year: "Aug 2026" / "Aug. 2026". */
export const formatMonth = (timestamp: number | Date, locale: StreetImageryLocale): string =>
  format(timestamp, 'LLL yyyy', { locale: dateFnsLocale(locale) })

/** "2 months ago" / "vor 2 Monaten". */
export const formatRelativeDate = (
  timestamp: number | Date,
  locale: StreetImageryLocale,
  now: number | Date = Date.now(),
): string =>
  formatDistanceStrict(timestamp, now, { addSuffix: true, locale: dateFnsLocale(locale) })

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
