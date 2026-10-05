import { parseIsoDateStartMs } from '@osm-editor-kit/street-imagery'
import { useSelectedMapillaryFeature } from '@osm-editor-kit/street-imagery-react'
import { useSearch } from '@tanstack/react-router'
import { resolvePhotoDateFilter } from './photo-date-slider'

/**
 * The selected Mapillary sign (`feature` in the URL) with all photos that show it, the one of
 * them that is shown (`photo` in the URL), and the one to open first: the newest day's best,
 * from within the date filter if there is one.
 */
export function useSelectedSign() {
  const { feature, photo, photos = [], photoDate } = useSearch({ from: '/$mode' })
  const fromIso = resolvePhotoDateFilter(photoDate, photos.length > 0)?.from
  const fromMs = fromIso ? parseIsoDateStartMs(fromIso) : null
  const selected = useSelectedMapillaryFeature({
    featureId: feature,
    shownPhotoId: photo?.photoId,
    minCapturedAt: fromMs,
  })
  return { featureId: feature ?? null, ...selected }
}
