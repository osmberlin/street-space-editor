import {
  formatDateTooltip,
  formatLocalDateTime,
  formatMonth,
  formatRelativeDate,
} from '@osm-editor-kit/street-imagery'
import { useStreetImageryI18n } from './StreetImageryLocaleProvider'

type PhotoDateProps = {
  /** Capture time (ms); `null` shows "Unknown date". */
  timestamp: number | null | undefined
  className?: string
  /**
   * Capture time with the camera's UTC offset (`2025-03-08T15:40:35+01:00`). The tooltip then
   * shows date and time as the camera's clock had it, instead of the date alone.
   */
  localDateTime?: string
}

/**
 * A date as month and year ("Aug 2026"). The tooltip has the full date and, on a second line,
 * how long ago that is.
 */
export const PhotoDate = ({ timestamp, className, localDateTime }: PhotoDateProps) => {
  const { locale, messages } = useStreetImageryI18n()
  if (timestamp == null) {
    return <span className={className}>{messages.unknownDate}</span>
  }
  const precise = localDateTime ? formatLocalDateTime(localDateTime, locale) : null
  return (
    <time
      className={className}
      dateTime={new Date(timestamp).toISOString()}
      title={
        precise
          ? `${precise}\n${formatRelativeDate(timestamp, locale)}`
          : formatDateTooltip(timestamp, locale)
      }
    >
      {formatMonth(timestamp, locale)}
    </time>
  )
}
