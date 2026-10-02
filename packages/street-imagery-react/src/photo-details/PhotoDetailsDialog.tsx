import {
  formatDate,
  formatLocalDateTime,
  formatRelativeDate,
  providerById,
  type NormalizedPhoto,
} from '@osm-editor-kit/street-imagery'
import { useEffect, useRef, type ReactNode } from 'react'
import { useStreetImageryI18n } from '../i18n/StreetImageryLocaleProvider'
import { PHOTO_DETAILS_LABELS, type PhotoDetailsLabels } from './labels'

export type PhotoDetailsDialogProps = {
  /** The photo with its `details`, as a viewer's `onViewerPhoto` gives it. */
  photo: NormalizedPhoto
  open: boolean
  onClose: () => void
  /** Link to the photo on the provider's site, shown at the photo id. */
  externalUrl?: string
  /** Replace single texts; the rest follows the `StreetImageryLocaleProvider`'s language. */
  labels?: Partial<PhotoDetailsLabels>
}

const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} kB`

const LINK_CLASS = 'text-zinc-950 underline decoration-zinc-950/30 hover:decoration-zinc-950'

/** One block of the list; renders nothing when all its rows are empty. */
const Section = ({ title, rows }: { title: string; rows: [string, ReactNode][] }) => {
  const filled = rows.filter(([, value]) => value != null && value !== '')
  if (filled.length === 0) {
    return null
  }
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-xs/5 font-semibold tracking-wide text-zinc-500 uppercase">{title}</h3>
      <dl className="mt-1 grid grid-cols-[minmax(7rem,35%)_1fr] text-sm/6">
        {filled.map(([term, value]) => (
          <div className="col-span-2 grid grid-cols-subgrid border-t border-zinc-950/5" key={term}>
            <dt className="py-2 pr-3 text-zinc-500">{term}</dt>
            <dd className="min-w-0 py-2 wrap-break-word text-zinc-950">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * Everything known about a photo, as a modal: capture, camera, position, source and raw EXIF.
 * Replaces the providers' own legends (Panoramax's drawer), which do not fit a small viewer box.
 * A native `<dialog>`: Escape and a click on the backdrop close it.
 *
 * Lives in its own entry (`@osm-editor-kit/street-imagery-react/photo-details`), so apps that do
 * not import it do not bundle it.
 */
export const PhotoDetailsDialog = ({
  photo,
  open,
  onClose,
  externalUrl,
  labels,
}: PhotoDetailsDialogProps) => {
  const { locale } = useStreetImageryI18n()
  const t = { ...PHOTO_DETAILS_LABELS[locale], ...labels }
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(
    function syncOpenState() {
      const dialog = dialogRef.current
      if (!dialog) {
        return
      }
      if (open && !dialog.open) {
        dialog.showModal()
        // Opening focuses a control further down and scrolls to it; start at the top instead.
        dialog.firstElementChild?.scrollTo({ top: 0 })
      } else if (!open && dialog.open) {
        dialog.close()
      }
    },
    [open],
  )

  const details = photo.details ?? {}
  const provider = providerById[photo.providerId]
  const capturedAt =
    (details.capturedAtLocal ? formatLocalDateTime(details.capturedAtLocal, locale) : null) ??
    (photo.capturedAt != null ? formatDate(photo.capturedAt, locale) : null)
  // Built outside the row lists: the lists are plain data, not rendered arrays.
  const contact = details.creatorContact?.includes('@') ? (
    <a className={LINK_CLASS} href={`mailto:${details.creatorContact}`}>
      {details.creatorContact}
    </a>
  ) : (
    details.creatorContact
  )
  const license =
    details.license && details.licenseUrl ? (
      <a className={LINK_CLASS} href={details.licenseUrl} rel="noreferrer" target="_blank">
        {details.license}
      </a>
    ) : (
      details.license
    )
  const photoId = externalUrl ? (
    <a className={LINK_CLASS} href={externalUrl} rel="noreferrer" target="_blank">
      {photo.photoId}
    </a>
  ) : (
    photo.photoId
  )
  const exif = Object.entries(details.exif ?? {}).sort(([a], [b]) => a.localeCompare(b))

  return (
    <dialog
      aria-labelledby="photo-details-title"
      className="m-auto w-full max-w-lg rounded-2xl bg-white p-0 shadow-lg ring-1 ring-zinc-950/10 backdrop:bg-zinc-950/25"
      ref={dialogRef}
      onClick={(event) => {
        // The dialog element itself is only hit on the backdrop; the content is inside the div.
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      onClose={onClose}
      onKeyDown={(event) => {
        // Escape closes this dialog only, not the viewer box behind it.
        if (event.key === 'Escape') {
          event.stopPropagation()
        }
      }}
    >
      <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base/6 font-semibold text-zinc-950" id="photo-details-title">
            {t.title}
            <span className="ml-2 font-normal text-zinc-500">{provider.label}</span>
          </h2>
          <button
            className="-m-1 rounded-md p-1 text-sm/6 font-medium text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950"
            type="button"
            onClick={onClose}
          >
            {t.close}
          </button>
        </div>

        <div className="mt-6">
          <Section
            rows={[
              [t.creator, photo.creatorName],
              [t.contact, contact],
              [
                t.capturedAt,
                capturedAt && photo.capturedAt != null
                  ? `${capturedAt} · ${formatRelativeDate(photo.capturedAt, locale)}`
                  : capturedAt,
              ],
              [
                t.uploadedAt,
                details.uploadedAt != null ? formatDate(details.uploadedAt, locale) : null,
              ],
              [t.license, license],
            ]}
            title={t.sectionCapture}
          />
          <Section
            rows={[
              [t.type, photo.isPano == null ? null : photo.isPano ? t.pano : t.flat],
              [t.camera, details.camera],
              [t.focalLength, details.focalLengthMm != null ? `${details.focalLengthMm} mm` : null],
              [
                t.fieldOfView,
                details.fieldOfViewDeg != null ? `${Math.round(details.fieldOfViewDeg)}°` : null,
              ],
            ]}
            title={t.sectionCamera}
          />
          <Section
            rows={[
              [t.coordinates, `${photo.lngLat[1].toFixed(6)}, ${photo.lngLat[0].toFixed(6)}`],
              [t.heading, photo.heading != null ? `${Math.round(photo.heading)}°` : null],
              [
                t.accuracy,
                details.positionAccuracyMeters != null
                  ? `± ${details.positionAccuracyMeters} m`
                  : null,
              ],
            ]}
            title={t.sectionPosition}
          />
          <Section
            rows={[
              [t.provider, provider.label],
              [t.instance, details.instance],
              [t.photoId, photoId],
              [t.sequence, photo.sequenceId],
              [t.rankInSequence, details.rankInSequence],
              [
                t.file,
                details.originalFileName
                  ? `${details.originalFileName}${details.originalFileSizeBytes != null ? ` (${formatBytes(details.originalFileSizeBytes)})` : ''}`
                  : null,
              ],
            ]}
            title={t.sectionSource}
          />
          {exif.length > 0 ? (
            <details className="mt-6 border-t border-zinc-950/5 pt-3">
              <summary className="cursor-pointer text-xs/5 font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-950">
                {t.exif(exif.length)}
              </summary>
              <dl className="mt-2 grid grid-cols-[minmax(7rem,45%)_1fr] text-xs/5">
                {exif.map(([key, value]) => (
                  <div
                    className="col-span-2 grid grid-cols-subgrid border-t border-zinc-950/5"
                    key={key}
                  >
                    <dt className="py-1 pr-3 wrap-break-word text-zinc-500">{key}</dt>
                    <dd className="min-w-0 py-1 wrap-break-word text-zinc-950">{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </div>
      </div>
    </dialog>
  )
}
