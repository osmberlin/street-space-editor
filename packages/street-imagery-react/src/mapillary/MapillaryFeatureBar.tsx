import {
  formatDateTooltip,
  formatMonth,
  mapillaryIconUrl,
  type MapFeatureImages,
  type TargetImage,
} from '@osm-editor-kit/street-imagery'
import { PhotoDate } from '../i18n/PhotoDate'
import { useStreetImageryI18n } from '../i18n/StreetImageryLocaleProvider'
import { MAPILLARY_FEATURE_BAR_LABELS, type MapillaryFeatureBarLabels } from './featureBarLabels'

export type MapillaryFeatureBarProps = {
  data: MapFeatureImages
  shownImage: TargetImage | null
  onShow: (image: TargetImage) => void
  /** Replace single texts, e.g. `name` to map values to your own sign catalogue. */
  labels?: Partial<MapillaryFeatureBarLabels>
}

/**
 * A Mapillary sign or object above its photo: what it is, when Mapillary saw it, and one button
 * per capture day (newest first). The shown day is highlighted; clicking it again steps through
 * that day's photos. Dates show month and year; the tooltip has the full date and the age.
 * Texts and dates follow the `StreetImageryLocaleProvider`.
 */
export const MapillaryFeatureBar = ({
  data,
  shownImage,
  onShow,
  labels: labelOverrides,
}: MapillaryFeatureBarProps) => {
  const { locale } = useStreetImageryI18n()
  const labels = { ...MAPILLARY_FEATURE_BAR_LABELS[locale], ...labelOverrides }
  const { feature, days, images } = data
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5" title={feature.value}>
        {/* Mapillary's icon for the value; not every value has one. */}
        <img
          alt=""
          className="size-7 shrink-0"
          key={feature.value}
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
          src={mapillaryIconUrl(feature.value)}
        />
        <div className="min-w-0">
          <p className="truncate text-sm leading-tight font-medium text-slate-900">
            {labels.name(feature.value)}
          </p>
          <p className="truncate text-xs leading-tight text-slate-500">
            {labels.seen} <PhotoDate timestamp={feature.firstSeenAt} /> –{' '}
            <PhotoDate timestamp={feature.lastSeenAt} />
          </p>
        </div>
      </div>
      {days.length === 0 ? (
        <p className="text-xs text-slate-500">{labels.noPhotos}</p>
      ) : (
        <div
          aria-label={labels.daysSummary(images.length, days.length)}
          className="flex gap-1 overflow-x-auto"
          role="group"
        >
          {days.map((day) => {
            const noon = new Date(`${day.day}T12:00:00Z`)
            const shownIndex = shownImage
              ? day.images.findIndex((image) => image.id === shownImage.id)
              : -1
            const active = shownIndex >= 0
            return (
              <button
                aria-pressed={active}
                className={`shrink-0 rounded-md border px-2 py-1 text-xs whitespace-nowrap ${active ? 'border-amber-500 bg-amber-100 text-amber-950' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                key={day.day}
                onClick={() => {
                  // The shown day again: step to its next photo.
                  const next = active ? day.images[(shownIndex + 1) % day.images.length] : day.best
                  if (next) {
                    onShow(next)
                  }
                }}
                title={`${formatDateTooltip(noon, locale)}\n${labels.dayPhotos(day.images.length, active && day.images.length > 1)}`}
                type="button"
              >
                <span className="font-medium">{formatMonth(noon, locale)}</span>{' '}
                <span className={active ? 'text-amber-800' : 'text-slate-500'}>
                  {active ? `${shownIndex + 1}/` : ''}
                  {day.images.length}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
