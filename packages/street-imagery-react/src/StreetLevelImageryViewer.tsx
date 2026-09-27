import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import { lazy, Suspense } from 'react'
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
  /** Mapillary only: full photo data for each image the viewer shows. */
  onViewerPhoto?: (photo: NormalizedPhoto) => void
  /** Mapillary 360° photos: initial view bearing (e.g. a suggested view direction). */
  lookAtBearing?: number | null
}

const ViewerPanelPlaceholder = () => (
  <div className="flex min-h-48 animate-pulse items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
    <span className="text-sm text-slate-500">Loading viewer…</span>
  </div>
)

export const StreetLevelImageryViewer = ({
  photo,
  groupPhotos,
  onPhotoSelected,
  onEaseMapToPoint,
  onViewerPhoto,
  lookAtBearing,
}: StreetLevelImageryViewerProps) => {
  if (photo.providerId === 'mapillary') {
    return (
      <Suspense fallback={<ViewerPanelPlaceholder />}>
        <MapillaryPanel
          groupPhotos={groupPhotos}
          onEaseMapToPoint={onEaseMapToPoint}
          onPhotoSelected={onPhotoSelected}
          lookAtBearing={lookAtBearing}
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
          onEaseMapToPoint={onEaseMapToPoint}
          onPhotoSelected={onPhotoSelected}
          photo={photo}
        />
      </Suspense>
    )
  }

  return null
}
