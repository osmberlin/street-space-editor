import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import { lazy, Suspense } from 'react'
import { useStreetImageryI18n } from './i18n/StreetImageryLocaleProvider'
import type { MapillaryLookAt, MapillaryViewerOutline } from './panels/mapillaryLookAt'
import type { StreetImageryPhotoSelection } from './types'

const MapillaryPanel = lazy(() =>
  import('./panels/MapillaryPanel').then((module) => ({
    default: module.MapillaryPanel,
  })),
)

const PanoramaxPanel = lazy(() =>
  import('./panels/PanoramaxPanel').then((module) => ({
    default: module.PanoramaxPanel,
  })),
)

type StreetLevelImageryViewerProps = {
  photo: NormalizedPhoto
  groupPhotos: NormalizedPhoto[]
  onPhotoSelected: (selection: StreetImageryPhotoSelection) => void
  onEaseMapToPoint: (lng: number, lat: number) => void
  /** Mapillary, Panoramax: full photo data (creator, licence …) for each image the viewer shows. */
  onViewerPhoto?: (photo: NormalizedPhoto) => void
  /** Mapillary 360° photos: initial view bearing (e.g. a suggested view direction). */
  lookAtBearing?: number | null
  /** Mapillary: turn and zoom to a place (sign, traffic light, junction); wins over `lookAtBearing`. */
  lookAt?: MapillaryLookAt | null
  /** Mapillary: outlines to draw in the shown image. */
  outlines?: MapillaryViewerOutline[]
  /**
   * Hide the viewer's own attribution (Mapillary) or legend (Panoramax); the host must then show
   * creator and licence itself, from `onViewerPhoto`.
   */
  hideAttribution?: boolean
}

const ViewerPanelPlaceholder = () => {
  const { messages } = useStreetImageryI18n()
  return (
    <div className="flex min-h-48 animate-pulse items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
      <span className="text-sm text-slate-500">{messages.viewer.loading}</span>
    </div>
  )
}

export const StreetLevelImageryViewer = ({
  photo,
  groupPhotos,
  onPhotoSelected,
  onEaseMapToPoint,
  onViewerPhoto,
  lookAtBearing,
  lookAt,
  outlines,
  hideAttribution,
}: StreetLevelImageryViewerProps) => {
  if (photo.providerId === 'mapillary') {
    return (
      <Suspense fallback={<ViewerPanelPlaceholder />}>
        <MapillaryPanel
          groupPhotos={groupPhotos}
          hideAttribution={hideAttribution}
          onEaseMapToPoint={onEaseMapToPoint}
          onPhotoSelected={onPhotoSelected}
          lookAt={lookAt}
          lookAtBearing={lookAtBearing}
          outlines={outlines}
          onViewerPhoto={onViewerPhoto}
          photo={photo}
        />
      </Suspense>
    )
  }

  if (photo.providerId === 'panoramax') {
    return (
      <Suspense fallback={<ViewerPanelPlaceholder />}>
        <PanoramaxPanel
          groupPhotos={groupPhotos}
          hideLegend={hideAttribution}
          onViewerPhoto={onViewerPhoto}
          onEaseMapToPoint={onEaseMapToPoint}
          onPhotoSelected={onPhotoSelected}
          photo={photo}
        />
      </Suspense>
    )
  }

  return null
}
