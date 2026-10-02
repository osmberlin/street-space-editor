import { formatDateTooltip, formatMonth } from '@osm-editor-kit/street-imagery'
import { useStreetImageryI18n } from './StreetImageryLocaleProvider'

type PhotoDateProps = {
  /** Capture time (ms); `null` shows "Unknown date". */
  timestamp: number | null | undefined
  className?: string
}

/**
 * A date as month and year ("Aug 2026"). The tooltip has the full date and, on a second line,
 * how long ago that is.
 */
export const PhotoDate = ({ timestamp, className }: PhotoDateProps) => {
  const { locale, messages } = useStreetImageryI18n()
  if (timestamp == null) {
    return <span className={className}>{messages.unknownDate}</span>
  }
  return (
    <time
      className={className}
      dateTime={new Date(timestamp).toISOString()}
      title={formatDateTooltip(timestamp, locale)}
    >
      {formatMonth(timestamp, locale)}
    </time>
  )
}
