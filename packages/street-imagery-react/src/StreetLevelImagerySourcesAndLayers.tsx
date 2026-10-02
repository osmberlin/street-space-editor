import { setStreetImageryConfig, type StreetImageryConfig } from '@osm-editor-kit/street-imagery'
import {
  emptyLineCollection,
  emptyPointCollection,
  emptyPolygonCollection,
  mapFeaturesToFeatureCollection,
  photosToFeatureCollection,
  photosToViewfieldsFeatureCollection,
  VIEWFIELD_MIN_ZOOM,
  sequencesToFeatureCollection,
} from '@osm-editor-kit/street-imagery'
import {
  buildMapFeatureLayerFilter,
  buildPhotoLayerFilter,
  photoMatchesFilters,
  type DateRange,
  type PhotoTypeFilter,
} from '@osm-editor-kit/street-imagery'
import type { Bbox, NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import {
  adapterById,
  featureLayerId,
  featureSourceId,
  photoLayerId,
  photoSourceId,
  sequenceLayerId,
  sequenceSourceId,
  viewfieldLayerId,
  viewfieldLineLayerId,
  viewfieldSourceId,
  type ProviderId,
} from '@osm-editor-kit/street-imagery'
import type { DataDrivenPropertyValueSpecification, ExpressionSpecification } from 'maplibre-gl'
import { Fragment, useEffect } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import {
  useProviderMapFeatures,
  useProviderPhotos,
  useProviderSequences,
} from './hooks/useProviderData'
import {
  resolveSelectedSequence,
  StreetLevelImagerySelectionOverlay,
} from './StreetLevelImagerySelectionOverlay'
import { StreetLevelImageryViewCone } from './StreetLevelImageryViewCone'

export type PhotoFilter = {
  photoTypes?: PhotoTypeFilter[]
  date?: DateRange
  /**
   * Which map features (signs, objects) to draw, by Mapillary value. Use `matchesAnyGroup(...)`
   * for groups like traffic lights or bike signs. Keep the function identity stable.
   */
  mapFeatureValue?: (value: string) => boolean
}

type ProviderLayerProps = {
  providerId: ProviderId
  bbox: Bbox | null
  zoom: number
  filter?: PhotoFilter
  showSequences: boolean
  showViewfields: boolean
  photoCircleColor: DataDrivenPropertyValueSpecification<string>
  mapFeatureCircleColor: DataDrivenPropertyValueSpecification<string>
}

const CIRCLE_RADIUS: ['interpolate', ['linear'], ['zoom'], ...number[]] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  2,
  14,
  4,
  18,
  6,
]

const FEATURE_CIRCLE_RADIUS: ['interpolate', ['linear'], ['zoom'], ...number[]] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  1.5,
  14,
  3,
  18,
  4,
]

/** Grow a bbox by `factor` of its size on each side. */
const padBbox = ([west, south, east, north]: Bbox, factor: number): Bbox => {
  const dx = (east - west) * factor
  const dy = (north - south) * factor
  return [west - dx, south - dy, east + dx, north + dy]
}

const lngLatInBbox = ([lng, lat]: [number, number], [west, south, east, north]: Bbox) =>
  lng >= west && lng <= east && lat >= south && lat <= north

const PHOTO_SORT_KEY: ExpressionSpecification = ['coalesce', ['get', 'capturedAt'], 0]
const FEATURE_SORT_KEY: ExpressionSpecification = ['coalesce', ['get', 'lastSeenAt'], 0]

const PhotoProviderLayer = ({
  providerId,
  bbox,
  zoom,
  filter,
  showSequences,
  showViewfields,
  photoCircleColor,
}: ProviderLayerProps) => {
  const adapter = adapterById[providerId]
  const { data: photos = [] } = useProviderPhotos(providerId, bbox, zoom)
  const { data: sequences = [] } = useProviderSequences(providerId, bbox, zoom)

  const visiblePhotos =
    zoom >= adapter.minZoom
      ? photos.filter((photo) => photoMatchesFilters(photo, filter?.photoTypes, filter?.date))
      : []

  // Tiles reach far beyond the viewport; draw only nearby photos matching the filters so dense
  // areas stay fast (the layer filter below still applies for style-only changes).
  const drawBbox = bbox ? padBbox(bbox, 0.25) : null
  const photoCollection =
    zoom >= adapter.minZoom
      ? photosToFeatureCollection(
          drawBbox
            ? visiblePhotos.filter((photo) => lngLatInBbox(photo.lngLat, drawBbox))
            : visiblePhotos,
        )
      : emptyPointCollection()
  // Providers load whole tiles; draw viewfields only when zoomed in, and only for the viewport.
  const viewfieldsActive = showViewfields && zoom >= VIEWFIELD_MIN_ZOOM
  const viewfieldCollection = viewfieldsActive
    ? photosToViewfieldsFeatureCollection(visiblePhotos, zoom, { bbox })
    : emptyPolygonCollection()

  const photoFilter = buildPhotoLayerFilter(filter?.photoTypes, filter?.date)
  const photoSrcId = photoSourceId(providerId)
  const viewfieldSrcId = viewfieldSourceId(providerId)

  // Enrich sequences missing dates from visible photos in the same sequence (Panoramax, etc.).
  const sequenceCapturedAtById = new Map<string, number>()
  for (const photo of visiblePhotos) {
    if (photo.sequenceId == null || photo.capturedAt == null) continue
    const prev = sequenceCapturedAtById.get(photo.sequenceId)
    if (prev == null || photo.capturedAt > prev) {
      sequenceCapturedAtById.set(photo.sequenceId, photo.capturedAt)
    }
  }

  const filteredSequences =
    showSequences && zoom >= (adapter.sequencesMinZoom ?? adapter.minZoom)
      ? sequences
          .map((sequence) => {
            if (sequence.capturedAt != null) return sequence
            const fromPhotos = sequenceCapturedAtById.get(sequence.sequenceId)
            return fromPhotos != null ? { ...sequence, capturedAt: fromPhotos } : sequence
          })
          .filter((sequence) => {
            const asPhoto = {
              providerId: sequence.providerId,
              photoId: sequence.sequenceId,
              sequenceId: sequence.sequenceId,
              capturedAt: sequence.capturedAt,
              isPano: sequence.isPano,
              heading: null,
              lngLat: [0, 0] as [number, number],
            }
            return photoMatchesFilters(asPhoto, filter?.photoTypes, filter?.date)
          })
      : []

  const sequenceCollection =
    filteredSequences.length > 0
      ? sequencesToFeatureCollection(filteredSequences)
      : emptyLineCollection()

  return (
    <>
      {adapter.fetchSequences && showSequences ? (
        <>
          <Source
            key={sequenceSourceId(providerId)}
            id={sequenceSourceId(providerId)}
            type="geojson"
            data={sequenceCollection}
          />
          <Layer
            id={sequenceLayerId(providerId)}
            type="line"
            source={sequenceSourceId(providerId)}
            paint={{
              'line-color': adapter.color,
              'line-width': 2,
              'line-opacity': 0.35,
            }}
          />
        </>
      ) : null}

      {showViewfields ? (
        <>
          <Source
            key={viewfieldSrcId}
            id={viewfieldSrcId}
            type="geojson"
            data={viewfieldCollection}
          />
          <Layer
            id={viewfieldLayerId(providerId)}
            type="fill"
            source={viewfieldSrcId}
            paint={{
              'fill-color': photoCircleColor,
              'fill-opacity': 0.22,
            }}
          />
          <Layer
            id={viewfieldLineLayerId(providerId)}
            type="line"
            source={viewfieldSrcId}
            paint={{
              'line-color': photoCircleColor,
              'line-width': 1,
              'line-opacity': 0.45,
            }}
          />
        </>
      ) : null}

      <Source
        key={photoSrcId}
        id={photoSrcId}
        type="geojson"
        data={photoCollection}
        promoteId="photoId"
      />
      <Layer
        id={photoLayerId(providerId)}
        type="circle"
        source={photoSrcId}
        filter={photoFilter}
        layout={{ 'circle-sort-key': PHOTO_SORT_KEY }}
        paint={{
          'circle-radius': CIRCLE_RADIUS,
          'circle-color': photoCircleColor,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        }}
      />
    </>
  )
}

const MapFeatureProviderLayer = ({
  providerId,
  bbox,
  zoom,
  filter,
  mapFeatureCircleColor,
}: ProviderLayerProps) => {
  const adapter = adapterById[providerId]
  const { data: features = [] } = useProviderMapFeatures(providerId, bbox, zoom)

  const valueFilter = filter?.mapFeatureValue
  const featureCollection =
    zoom >= adapter.minZoom
      ? mapFeaturesToFeatureCollection(
          valueFilter ? features.filter((feature) => valueFilter(feature.value)) : features,
        )
      : emptyPointCollection()

  const featureFilter = buildMapFeatureLayerFilter(filter?.date)
  const featureSrcId = featureSourceId(providerId)

  return (
    <>
      <Source
        key={featureSrcId}
        id={featureSrcId}
        type="geojson"
        data={featureCollection}
        promoteId="featureId"
      />
      <Layer
        id={featureLayerId(providerId)}
        type="circle"
        source={featureSrcId}
        filter={featureFilter}
        layout={{ 'circle-sort-key': FEATURE_SORT_KEY }}
        paint={{
          'circle-radius': FEATURE_CIRCLE_RADIUS,
          'circle-color': mapFeatureCircleColor,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        }}
      />
    </>
  )
}

const ProviderLayer = (props: ProviderLayerProps) => {
  const adapter = adapterById[props.providerId]
  return adapter.kind === 'mapFeature' ? (
    <MapFeatureProviderLayer {...props} />
  ) : (
    <PhotoProviderLayer {...props} />
  )
}

export type StreetLevelImagerySourcesAndLayersProps = {
  providers: ProviderId[]
  filter?: PhotoFilter
  bbox: Bbox | null
  zoom: number
  options: {
    config?: StreetImageryConfig
    showSequences?: boolean
    /** Heading wedges / 360° disks per photo, from zoom 16, capped for dense areas. Default true. */
    showViewfields?: boolean
    showViewCone?: boolean
    showSelectionHighlight?: boolean
    selectedPhoto?: NormalizedPhoto | null
    selectedSequenceId?: string | null
    viewerPov?: {
      bearing?: number | null
      hfov?: number | null
      lngLat?: [number, number] | null
    } | null
    photoCircleColor: DataDrivenPropertyValueSpecification<string>
    mapFeatureCircleColor: DataDrivenPropertyValueSpecification<string>
  }
}

export const StreetLevelImagerySourcesAndLayers = ({
  providers,
  filter,
  bbox,
  zoom,
  options,
}: StreetLevelImagerySourcesAndLayersProps) => {
  const {
    config,
    showSequences = true,
    showViewfields = true,
    showViewCone = false,
    showSelectionHighlight = false,
    selectedPhoto,
    selectedSequenceId,
    viewerPov,
    photoCircleColor,
    mapFeatureCircleColor,
  } = options

  useEffect(
    function applyStreetImageryConfig() {
      if (config) {
        setStreetImageryConfig(config)
      }
    },
    [config],
  )

  const selectedProviderId = selectedPhoto?.providerId ?? null
  const { data: sequences = [] } = useProviderSequences(
    selectedProviderId ?? 'mapillary',
    showSelectionHighlight && selectedProviderId ? bbox : null,
    zoom,
  )

  const selectedSequence = resolveSelectedSequence(
    selectedPhoto,
    sequences,
    selectedSequenceId ?? selectedPhoto?.sequenceId,
  )

  // The shown photo's sequence goes below the lowest photo layer, so dots stay on top of it.
  const firstPhotoProvider = providers.find(
    (id) => adapterById[id].kind === 'photo' && adapterById[id].fetchPhotos,
  )
  const sequenceBeforeId = firstPhotoProvider
    ? showViewfields
      ? viewfieldLayerId(firstPhotoProvider)
      : photoLayerId(firstPhotoProvider)
    : undefined

  return (
    <>
      {providers.map((providerId) => (
        <Fragment key={providerId}>
          <ProviderLayer
            bbox={bbox}
            filter={filter}
            mapFeatureCircleColor={mapFeatureCircleColor}
            photoCircleColor={photoCircleColor}
            providerId={providerId}
            showSequences={showSequences}
            showViewfields={showViewfields}
            zoom={zoom}
          />
        </Fragment>
      ))}

      {showViewCone && selectedPhoto ? (
        <StreetLevelImageryViewCone
          selectedPhoto={selectedPhoto}
          viewerPov={viewerPov}
          zoom={zoom}
        />
      ) : null}

      {showSelectionHighlight ? (
        <StreetLevelImagerySelectionOverlay
          cameraLngLat={viewerPov?.lngLat}
          selectedPhoto={selectedPhoto}
          selectedSequence={selectedSequence}
          sequenceBeforeId={sequenceBeforeId}
        />
      ) : null}
    </>
  )
}
