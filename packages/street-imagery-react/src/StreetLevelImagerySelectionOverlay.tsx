import {
  distanceMeters,
  emptyLineCollection,
  sequencesToFeatureCollection,
} from '@osm-editor-kit/street-imagery'
import type { Bbox, NormalizedPhoto, NormalizedSequence } from '@osm-editor-kit/street-imagery'
import type { FeatureCollection, LineString, Point } from 'geojson'
import { Layer, Source } from 'react-map-gl/maplibre'

const POINTS_SOURCE_ID = 'selection-highlight'
const CONNECTOR_SOURCE_ID = 'selection-connector'
const SEQUENCE_HIGHLIGHT_SOURCE_ID = 'sequence-highlight'

/** Accent of the photo that is shown in the viewer: its sequence, marker and view cone. */
export const SELECTION_COLOR = '#f97316'

/** Below this distance the photo dot and the viewer's camera position count as the same spot. */
const SAME_POSITION_METERS = 0.75

export type StreetLevelImagerySelectionOverlayProps = {
  selectedPhoto?: NormalizedPhoto | null
  selectedSequence?: NormalizedSequence | null
  /**
   * Where the viewer says the camera was (Mapillary: the computed position, which the view cone
   * starts at). When it differs from the photo dot, a pin marks it and a line connects both.
   */
  cameraLngLat?: [number, number] | null
  /** Layer to draw the sequence line below, so photo dots stay on top of it. */
  sequenceBeforeId?: string
}

/**
 * The shown photo on the map, bottom to top: its sequence (thin line with a white casing, below
 * the photo dots), a ring around its photo dot, and — when the camera position differs from the
 * dot — a dashed connector and a pin at the camera position.
 */
export const StreetLevelImagerySelectionOverlay = ({
  selectedPhoto,
  selectedSequence,
  cameraLngLat,
  sequenceBeforeId,
}: StreetLevelImagerySelectionOverlayProps) => {
  const sequenceCollection = selectedSequence
    ? sequencesToFeatureCollection([selectedSequence])
    : emptyLineCollection()

  if (!selectedPhoto && sequenceCollection.features.length === 0) {
    return null
  }

  const dot = selectedPhoto?.lngLat
  const camera =
    dot && cameraLngLat && distanceMeters(dot, cameraLngLat) > SAME_POSITION_METERS
      ? cameraLngLat
      : null

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
      {/* A ring, so the photo dot below stays visible. */}
      <Layer
        id="selection-highlight-layer"
        type="circle"
        source={POINTS_SOURCE_ID}
        filter={['==', ['get', 'kind'], 'dot']}
        paint={{
          'circle-radius': 9,
          'circle-color': SELECTION_COLOR,
          'circle-opacity': 0.12,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': SELECTION_COLOR,
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
