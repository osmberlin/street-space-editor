import {
  MAP_FEATURE_COLOR,
  type Bbox,
  type MapFeatureImages,
  type ProviderId,
  type TargetImage,
} from '@osm-editor-kit/street-imagery'
import type { FeatureCollection, LineString, Point } from 'geojson'
import { Layer, Source } from 'react-map-gl/maplibre'
import { useAllProviderMapFeatures } from '../hooks/useAllProviderMapFeatures'
import { SELECTION_COLOR } from '../StreetLevelImagerySelectionOverlay'
import { VIEW_SHAPE_FILL_OPACITY } from '../StreetLevelImageryViewCone'

export type SelectedMapFeatureLayerProps = {
  /** From `useSelectedMapillaryFeature`. Nothing is drawn without it. */
  data: MapFeatureImages | null
  /** The shown photo of the feature: a dotted line runs from its camera to the feature. */
  shownImage?: TargetImage | null
  /** The providers whose map features are drawn, to ring the dot that is on the map. */
  providers: ProviderId[]
  bbox: Bbox | null
  zoom: number
  /** Color of the dot and disk. Default: the map features' purple. */
  color?: string
}

/**
 * The selected sign or object on the map: its dot on a light disk, and a dotted line to it from
 * the camera position of the shown photo (Mapillary's computed position, which the feature was
 * located from). Draw it after `StreetLevelImagerySourcesAndLayers`.
 */
export const SelectedMapFeatureLayer = ({
  data,
  shownImage,
  providers,
  bbox,
  zoom,
  color = MAP_FEATURE_COLOR,
}: SelectedMapFeatureLayerProps) => {
  const drawnFeatures = useAllProviderMapFeatures(providers, bbox, zoom)

  // The dot on the map comes from vector tiles, whose position can differ a little from the Graph
  // API's. Ring the dot that is drawn; fall back to the API position when it is not loaded.
  const target = data
    ? (drawnFeatures.find((feature) => feature.featureId === data.feature.id)?.lngLat ??
      data.feature.lngLat)
    : null
  const camera = shownImage?.lngLat

  const points: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: target
      ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: target } }]
      : [],
  }
  const line: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features:
      target && camera
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [camera, target] },
            },
          ]
        : [],
  }

  return (
    <>
      <Source data={line} id="selected-map-feature-line" type="geojson" />
      <Layer
        id="selected-map-feature-line"
        paint={{ 'line-color': SELECTION_COLOR, 'line-width': 1.5, 'line-dasharray': [2, 1.5] }}
        source="selected-map-feature-line"
        type="line"
      />
      <Source data={points} id="selected-map-feature-point" type="geojson" />
      {/* A light disk without an edge, like the 360° disks of photos. */}
      <Layer
        id="selected-map-feature-disk"
        paint={{
          'circle-radius': 17,
          'circle-color': color,
          'circle-opacity': VIEW_SHAPE_FILL_OPACITY,
        }}
        source="selected-map-feature-point"
        type="circle"
      />
      {/* The feature's dot, 20 % larger than the other features' dots. */}
      <Layer
        id="selected-map-feature-dot"
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 14, 3.6, 18, 4.8],
          'circle-color': color,
        }}
        source="selected-map-feature-point"
        type="circle"
      />
    </>
  )
}
