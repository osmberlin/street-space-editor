import {
  distanceMeters,
  emptyLineCollection,
  sequencesToFeatureCollection,
} from '@osm-editor-kit/street-imagery'
import type { Bbox, NormalizedPhoto, NormalizedSequence } from '@osm-editor-kit/street-imagery'
import type { FeatureCollection, LineString, MultiLineString, Point } from 'geojson'
import { Layer, Source } from 'react-map-gl/maplibre'

const POINTS_SOURCE_ID = 'selection-highlight'
const CONNECTOR_SOURCE_ID = 'selection-connector'
const SEQUENCE_HIGHLIGHT_SOURCE_ID = 'sequence-highlight'

/** Accent of the photo that is shown in the viewer: its sequence, marker and view cone. */
export const SELECTION_COLOR = '#f97316'

/** Below this distance the photo dot and the viewer's camera position count as the same spot. */
const SAME_POSITION_METERS = 0.75

/**
 * Sequence lines come simplified from the vector tiles, so they pass near the photo, not through
 * it. Within this distance the nearest corner of the line is moved onto a photo of the line.
 */
const SNAP_LINE_METERS = 6

/**
 * Move, for each point, the nearest corner of the lines onto it (when within reach). Each corner
 * moves once; earlier points win.
 */
const snapCornersToPoints = (
  collection: FeatureCollection<LineString | MultiLineString>,
  points: readonly [number, number][],
): FeatureCollection<LineString | MultiLineString> => {
  if (points.length === 0 || collection.features.length === 0) {
    return collection
  }
  const features = collection.features.map((feature) => ({
    ...feature,
    geometry:
      feature.geometry.type === 'LineString'
        ? { ...feature.geometry, coordinates: feature.geometry.coordinates.map((c) => [...c]) }
        : {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map((line) => line.map((c) => [...c])),
          },
  }))
  const corners = features.flatMap((feature) =>
    feature.geometry.type === 'LineString'
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat(),
  )
  const moved = new Set<number[]>()
  for (const point of points) {
    let best: { corner: number[]; distance: number } | null = null
    for (const corner of corners) {
      const [lng, lat] = corner
      if (lng == null || lat == null || moved.has(corner)) {
        continue
      }
      // Cheap reject before the exact distance (0.0001° is about 7 to 11 m).
      if (Math.abs(lng - point[0]) > 0.0001 || Math.abs(lat - point[1]) > 0.0001) {
        continue
      }
      const distance = distanceMeters([lng, lat], point)
      if (distance <= SNAP_LINE_METERS && (!best || distance < best.distance)) {
        best = { corner, distance }
      }
    }
    if (best) {
      best.corner[0] = point[0]
      best.corner[1] = point[1]
      moved.add(best.corner)
    }
  }
  return { ...collection, features }
}

export type StreetLevelImagerySelectionOverlayProps = {
  selectedPhoto?: NormalizedPhoto | null
  selectedSequence?: NormalizedSequence | null
  /**
   * Where the viewer says the camera was (Mapillary: the computed position, which the view cone
   * starts at). When it differs from the photo dot, a pin marks it and a line connects both.
   */
  cameraLngLat?: [number, number] | null
  /**
   * Positions of the sequence's photo dots on the map. The line's corners move onto them, so the
   * line runs through its dots.
   */
  sequencePhotoLngLats?: readonly [number, number][]
  /** Layer to draw the sequence line below, so photo dots stay on top of it. */
  sequenceBeforeId?: string
}

/**
 * The shown photo on the map, bottom to top: its sequence (thin line with a white casing, below
 * the photo dots), a filled marker on its photo dot, and — when the camera position differs from the
 * dot — a dashed connector and a pin at the camera position.
 */
export const StreetLevelImagerySelectionOverlay = ({
  selectedPhoto,
  selectedSequence,
  cameraLngLat,
  sequencePhotoLngLats,
  sequenceBeforeId,
}: StreetLevelImagerySelectionOverlayProps) => {
  const photoLngLat = selectedPhoto?.lngLat
  const cameraDiffers =
    photoLngLat != null &&
    cameraLngLat != null &&
    distanceMeters(photoLngLat, cameraLngLat) > SAME_POSITION_METERS
  const camera = cameraDiffers ? cameraLngLat : null
  // Same spot: take the viewer's position, so marker and view cone share one point exactly.
  const dot = photoLngLat && cameraLngLat && !cameraDiffers ? cameraLngLat : photoLngLat

  const sequenceLines: FeatureCollection<LineString | MultiLineString> = selectedSequence
    ? sequencesToFeatureCollection([selectedSequence])
    : emptyLineCollection()
  const sequenceCollection = snapCornersToPoints(sequenceLines, [
    ...(dot ? [dot] : []),
    ...(sequencePhotoLngLats ?? []),
  ])

  if (!selectedPhoto && sequenceCollection.features.length === 0) {
    return null
  }

  const points: FeatureCollection<Point, { kind: 'dot' | 'camera' }> = {
    type: 'FeatureCollection',
    features: [
      ...(dot
        ? [
            {
              type: 'Feature' as const,
              properties: { kind: 'dot' as const },
              geometry: { type: 'Point' as const, coordinates: dot },
            },
          ]
        : []),
      ...(camera
        ? [
            {
              type: 'Feature' as const,
              properties: { kind: 'camera' as const },
              geometry: { type: 'Point' as const, coordinates: camera },
            },
          ]
        : []),
    ],
  }
  const connector: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features:
      dot && camera
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [dot, camera] },
            },
          ]
        : [],
  }

  return (
    <>
      <Source id={SEQUENCE_HIGHLIGHT_SOURCE_ID} type="geojson" data={sequenceCollection} />
      <Layer
        beforeId={sequenceBeforeId}
        id="sequence-highlight-casing"
        type="line"
        source={SEQUENCE_HIGHLIGHT_SOURCE_ID}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.9 }}
      />
      <Layer
        beforeId={sequenceBeforeId}
        id="sequence-highlight-layer"
        type="line"
        source={SEQUENCE_HIGHLIGHT_SOURCE_ID}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': SELECTION_COLOR, 'line-width': 2.5 }}
      />

      <Source id={CONNECTOR_SOURCE_ID} type="geojson" data={connector} />
      <Layer
        id="selection-connector-layer"
        type="line"
        source={CONNECTOR_SOURCE_ID}
        paint={{ 'line-color': SELECTION_COLOR, 'line-width': 1.5, 'line-dasharray': [2, 1.5] }}
      />

      <Source id={POINTS_SOURCE_ID} type="geojson" data={points} />
      {/* Covers the photo dot below it. */}
      <Layer
        id="selection-highlight-layer"
        type="circle"
        source={POINTS_SOURCE_ID}
        filter={['==', ['get', 'kind'], 'dot']}
        paint={{
          'circle-radius': 6,
          'circle-color': SELECTION_COLOR,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        }}
      />
      <Layer
        id="selection-camera-layer"
        type="circle"
        source={POINTS_SOURCE_ID}
        filter={['==', ['get', 'kind'], 'camera']}
        paint={{
          'circle-radius': 5,
          'circle-color': SELECTION_COLOR,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        }}
      />
    </>
  )
}

/** Resolve sequence geometry for highlight when only photo + fetched sequences are available. */
export const resolveSelectedSequence = (
  selectedPhoto: NormalizedPhoto | null | undefined,
  sequences: NormalizedSequence[],
  sequenceId: string | null | undefined,
): NormalizedSequence | null => {
  if (!selectedPhoto || !sequenceId) {
    return null
  }

  return (
    sequences.find(
      (sequence) =>
        sequence.providerId === selectedPhoto.providerId && sequence.sequenceId === sequenceId,
    ) ?? null
  )
}

export type SequenceHighlightBbox = Bbox | null
