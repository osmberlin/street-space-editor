import {
  coneRadiusMeters,
  viewConeGeoJson,
  type LngLat,
  type ViewSuggestion,
  type Viewpoint,
} from '@osm-editor-kit/street-imagery'
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import type { MapGeoJSONFeature } from 'maplibre-gl'
import { Layer, Source } from 'react-map-gl/maplibre'

const SOURCE_DIRECTIONS = 'viewpoint-directions'
const SOURCE_POINTS = 'viewpoint-points'
const SOURCE_LINE = 'viewpoint-line'

/** Add to `interactiveLayerIds` to make view directions clickable; see `viewDirectionKeyFromFeatures`. */
export const VIEWPOINT_DIRECTION_LAYER_ID = 'viewpoint-direction-fill'

export const VIEWPOINT_DEFAULT_COLOR = '#c026d3'

type DirectionProps = { key: string; active: boolean; hasPhoto: boolean }

export type ViewpointLayerProps = {
  viewpoints: Viewpoint[]
  suggestions: ViewSuggestion[]
  activeDirectionKey: string | null
  zoom: number
  /** Clicked line, drawn below the viewpoints. */
  line?: LngLat[] | null
  color?: string
}

/** Cone length: clearly longer than photo view cones so viewpoints stand out between photo dots. */
const directionLengthMeters = (zoom: number) => Math.max(8, coneRadiusMeters(zoom) * 3)

export const ViewpointLayer = ({
  viewpoints,
  suggestions,
  activeDirectionKey,
  zoom,
  line,
  color = VIEWPOINT_DEFAULT_COLOR,
}: ViewpointLayerProps) => {
  const length = directionLengthMeters(zoom)
  const directions: FeatureCollection<Polygon, DirectionProps> = {
    type: 'FeatureCollection',
    features: suggestions.map(({ viewpoint, direction, candidates }) => ({
      ...viewConeGeoJson(viewpoint.lngLat, direction.bearing, 40, length),
      properties: {
        key: direction.key,
        active: direction.key === activeDirectionKey,
        hasPhoto: candidates.length > 0,
      },
    })),
  }
  const points: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: viewpoints.map(
      (viewpoint): Feature<Point> => ({
        type: 'Feature',
        properties: { id: viewpoint.id },
        geometry: { type: 'Point', coordinates: viewpoint.lngLat },
      }),
    ),
  }
  const lineFeature: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features:
      line && line.length > 1
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }]
        : [],
  }

  return (
    <>
      <Source id={SOURCE_LINE} type="geojson" data={lineFeature} />
      <Layer
        id="viewpoint-line"
        type="line"
        source={SOURCE_LINE}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': color, 'line-width': 5, 'line-opacity': 0.5 }}
      />
      <Source id={SOURCE_DIRECTIONS} type="geojson" data={directions} />
      <Layer
        id={VIEWPOINT_DIRECTION_LAYER_ID}
        type="fill"
        source={SOURCE_DIRECTIONS}
        paint={{
          'fill-color': color,
          'fill-opacity': ['case', ['get', 'active'], 0.55, ['get', 'hasPhoto'], 0.18, 0.04],
        }}
      />
      <Layer
        id="viewpoint-direction-line"
        type="line"
        source={SOURCE_DIRECTIONS}
        paint={{
          'line-color': color,
          'line-width': ['case', ['get', 'active'], 2, 1],
          'line-dasharray': [2, 1.5],
          'line-opacity': ['case', ['get', 'hasPhoto'], 0.9, 0.35],
        }}
      />
      <Source id={SOURCE_POINTS} type="geojson" data={points} />
      <Layer
        id="viewpoint-point"
        type="circle"
        source={SOURCE_POINTS}
        paint={{
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-stroke-color': color,
          'circle-stroke-width': 2.5,
        }}
      />
    </>
  )
}

/** Direction key of the top-most clicked view direction, if any. */
export const viewDirectionKeyFromFeatures = (
  features: MapGeoJSONFeature[] | undefined,
): string | null => {
  const hit = features?.find((feature) => feature.layer?.id === VIEWPOINT_DIRECTION_LAYER_ID)
  const key = hit?.properties?.key
  return typeof key === 'string' ? key : null
}
