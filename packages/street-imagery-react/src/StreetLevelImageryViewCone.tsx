import { coneRadiusMeters, viewConeGeoJson } from '@osm-editor-kit/street-imagery'
import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import { Layer, Source } from 'react-map-gl/maplibre'
import { SELECTION_COLOR } from './StreetLevelImagerySelectionOverlay'

const CONE_SOURCE_ID = 'view-direction-cone'
const CONE_FILL_LAYER_ID = 'view-direction-cone-fill'
const CONE_LINE_LAYER_ID = 'view-direction-cone-line'

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
}

export const StreetLevelImageryViewCone = ({
  selectedPhoto,
  zoom,
  viewerPov,
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
  } else {
    bearing = selectedPhoto.heading
    fov = 30
  }

  if (bearing == null) {
    return null
  }

  // Larger than the per-photo viewfields, so the shown photo's direction stands out.
  const coneFeature = viewConeGeoJson(apex, bearing, fov, coneRadiusMeters(zoom) * 2.5)

  return (
    <>
      <Source id={CONE_SOURCE_ID} type="geojson" data={coneFeature} />
      <Layer
        id={CONE_FILL_LAYER_ID}
        type="fill"
        source={CONE_SOURCE_ID}
        paint={{
          'fill-color': SELECTION_COLOR,
          'fill-opacity': 0.25,
        }}
      />
      <Layer
        id={CONE_LINE_LAYER_ID}
        type="line"
        source={CONE_SOURCE_ID}
        paint={{
          'line-color': SELECTION_COLOR,
          'line-width': 1.5,
          'line-opacity': 0.9,
        }}
      />
    </>
  )
}
