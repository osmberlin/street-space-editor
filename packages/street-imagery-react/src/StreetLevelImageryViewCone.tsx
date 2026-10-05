import { viewConeGeoJson, viewShapeRadiusMeters } from '@osm-editor-kit/street-imagery'
import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import type { DataDrivenPropertyValueSpecification } from 'maplibre-gl'
import { Layer, Source } from 'react-map-gl/maplibre'
import { SELECTION_COLOR } from './StreetLevelImagerySelectionOverlay'

const CONE_SOURCE_ID = 'view-direction-cone'
const CONE_FILL_LAYER_ID = 'view-direction-cone-fill'

/** The cone never gets narrower than this, however far the viewer is zoomed in. */
const MIN_CONE_FOV_DEG = 45

/** Fill of view-direction shapes: the 360° disks, the flat wedges and the shown photo's cone. */
export const VIEW_SHAPE_FILL_OPACITY = 0.25

const INTERACTIVE_PANO_PROVIDERS = new Set([
  'mapillary',
  'panoramax',
  'streetside',
  'kartaview',
  'mapilio',
  'vegbilder',
])

export type StreetLevelImageryViewConeProps = {
  selectedPhoto: NormalizedPhoto
  zoom: number
  viewerPov?: {
    bearing?: number | null
    hfov?: number | null
    lngLat?: [number, number] | null
  } | null
  /**
   * Fill colour; an expression may read the photo's `isPano` and `capturedAt`, so the cone gets
   * the same colour as the photo's own view-direction shape.
   */
  color?: DataDrivenPropertyValueSpecification<string>
  /** Cone length as a multiple of the per-photo view-direction shapes. Default 2.5. */
  scale?: number
  /** Id of a layer of the host's style to draw the cone below. */
  beforeId?: string
}

export const StreetLevelImageryViewCone = ({
  selectedPhoto,
  zoom,
  viewerPov,
  color = SELECTION_COLOR,
  scale = 2.5,
  beforeId,
}: StreetLevelImageryViewConeProps) => {
  const apex = viewerPov?.lngLat ?? selectedPhoto.lngLat
  const isPano = selectedPhoto.isPano === true
  const hasLiveBearing = isPano && INTERACTIVE_PANO_PROVIDERS.has(selectedPhoto.providerId)

  let bearing: number | null = null
  let fov = 30

  if (isPano) {
    bearing = hasLiveBearing ? (viewerPov?.bearing ?? selectedPhoto.heading) : selectedPhoto.heading
    fov = hasLiveBearing ? (viewerPov?.hfov ?? 60) : 60
  } else if (selectedPhoto.providerId === 'panoramax') {
    bearing = viewerPov?.bearing ?? selectedPhoto.heading
    fov = 30
  } else if (selectedPhoto.providerId === 'mapillary') {
    // The heading of the map tiles is the camera's own compass reading, which is often far off
    // (e.g. north for a photo along a street). The viewer reports the direction Mapillary computed
    // from the image, as mapillary.com shows it.
    bearing = viewerPov?.bearing ?? selectedPhoto.heading
    fov = viewerPov?.hfov ?? 30
  } else {
    bearing = selectedPhoto.heading
    fov = 30
  }

  if (bearing == null) {
    return null
  }

  // A viewer zoomed far in has a field of view of a few degrees: a sliver that is hard to see.
  fov = Math.max(fov, MIN_CONE_FOV_DEG)

  // Larger than the per-photo viewfields, so the shown photo's direction stands out.
  const coneFeature = {
    ...viewConeGeoJson(apex, bearing, fov, viewShapeRadiusMeters(zoom) * scale),
    properties: { isPano: selectedPhoto.isPano, capturedAt: selectedPhoto.capturedAt },
  }

  return (
    <>
      <Source id={CONE_SOURCE_ID} type="geojson" data={coneFeature} />
      <Layer
        beforeId={beforeId}
        id={CONE_FILL_LAYER_ID}
        type="fill"
        source={CONE_SOURCE_ID}
        paint={{
          'fill-color': color,
          'fill-opacity': VIEW_SHAPE_FILL_OPACITY,
          'fill-outline-color': 'rgba(0, 0, 0, 0)',
        }}
      />
    </>
  )
}
