import { setStreetImageryConfig, type StreetImageryConfig } from '@osm-editor-kit/street-imagery'
import {
  alignLineToPoints,
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
  providerById,
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
  ACTIVE_LINE_WIDTH,
  BASE_COLOR,
  resolveSelectedSequence,
  SELECTION_COLOR,
  StreetLevelImagerySelectionOverlay,
} from './StreetLevelImagerySelectionOverlay'
import { StreetLevelImageryViewCone, VIEW_SHAPE_FILL_OPACITY } from './StreetLevelImageryViewCone'

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
  /** Sequence of the shown photo: its line is thicker. */
  activeSequenceId?: string | null
  /** A photo is shown (of any provider): everything but its sequence is muted. */
  hasActiveSequence: boolean
  /** The shown photo, when it is this provider's. */
  shownPhotoId?: string | null
}

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

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000
/** Fixed at load, so the layer paint stays stable between renders. */
const LOADED_AT = Date.now()

/**
 * Lines and dots fade with age: black for the last 12 months, then one step lighter per year,
 * down to the grey of muted lines. Solid greys, not opacity, so overlapping dots and lines stay
 * clean. Photos without a date are black.
 */
const AGE_SHADE: ExpressionSpecification = [
  'case',
  ['==', ['get', 'capturedAt'], null],
  BASE_COLOR,
  [
    'step',
    ['get', 'capturedAt'],
    '#909090',
    LOADED_AT - 3 * YEAR_MS,
    '#686868',
    LOADED_AT - 2 * YEAR_MS,
    '#404040',
    LOADED_AT - YEAR_MS,
    BASE_COLOR,
  ],
]

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
  activeSequenceId,
  hasActiveSequence,
  shownPhotoId,
}: ProviderLayerProps) => {
  const adapter = adapterById[providerId]
  const meta = providerById[providerId]
  const { data: photos = [] } = useProviderPhotos(providerId, bbox, zoom)
  const { data: sequences = [] } = useProviderSequences(providerId, bbox, zoom)

  const visiblePhotos =
    zoom >= meta.minZoom
      ? photos.filter((photo) => photoMatchesFilters(photo, filter?.photoTypes, filter?.date))
      : []

  // Tiles reach far beyond the viewport; draw only nearby photos matching the filters so dense
  // areas stay fast (the layer filter below still applies for style-only changes).
  const drawBbox = bbox ? padBbox(bbox, 0.25) : null
  const photoCollection =
    zoom >= meta.minZoom
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

  // `''` never matches: photos without a sequence have `null`.
  const inActiveSequence: ExpressionSpecification = [
    '==',
    ['get', 'sequenceId'],
    activeSequenceId ?? '',
  ]
  // While a photo is shown, lines and view shapes of the other sequences step back. Dots stay
  // solid black: see-through dots on see-through lines give muddy overlaps.
  const lineOpacity: ExpressionSpecification = [
    'case',
    inActiveSequence,
    1,
    hasActiveSequence ? 0.45 : 1,
  ]
  // Dots of the shown photo's sequence keep the full size; all others are smaller.
  const dotRadius: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    ['case', inActiveSequence, 2, 1.2],
    14,
    ['case', inActiveSequence, 4, 2],
    // Up to here there are no view shapes and the dots are 20 % smaller.
    VIEWFIELD_MIN_ZOOM - 0.01,
    ['case', inActiveSequence, 5.5, 2.9],
    VIEWFIELD_MIN_ZOOM,
    ['case', inActiveSequence, 5.5, 3.6],
    18,
    ['case', inActiveSequence, 6, 4],
  ]
  // Zoomed out there are no view shapes; dots and lines carry the style colour then.
  const lineAndDotColor: DataDrivenPropertyValueSpecification<string> = viewfieldsActive
    ? ['case', inActiveSequence, BASE_COLOR, AGE_SHADE]
    : photoCircleColor
  const viewShapeOpacity = (full: number): ExpressionSpecification => [
    'case',
    inActiveSequence,
    full,
    hasActiveSequence ? full * 0.4 : full,
  ]
  // The shown photo has the live view cone; its static shape would only double it.
  const notShownPhoto: ExpressionSpecification = ['!=', ['get', 'photoId'], shownPhotoId ?? '']
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
    showSequences && zoom >= meta.sequencesMinZoom
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

  // Tile lines are simplified and pass beside their photos; run them through the loaded photos.
  const photoLngLatsBySequence = new Map<string, [number, number][]>()
  for (const photo of photos) {
    if (photo.sequenceId == null) continue
    const list = photoLngLatsBySequence.get(photo.sequenceId)
    if (list) {
      list.push(photo.lngLat)
    } else {
      photoLngLatsBySequence.set(photo.sequenceId, [photo.lngLat])
    }
  }
  const alignedSequences = filteredSequences.map((sequence) => {
    const points = photoLngLatsBySequence.get(sequence.sequenceId)
    if (!points) return sequence
    const { geometry } = sequence
    return {
      ...sequence,
      geometry:
        geometry.type === 'LineString'
          ? {
              ...geometry,
              coordinates: alignLineToPoints(geometry.coordinates as [number, number][], points),
            }
          : {
              ...geometry,
              coordinates: geometry.coordinates.map((line) =>
                alignLineToPoints(line as [number, number][], points),
              ),
            },
    }
  })

  const sequenceCollection =
    alignedSequences.length > 0
      ? sequencesToFeatureCollection(alignedSequences)
      : emptyLineCollection()

  return (
    <>
      {meta.coverageTiles ? (
        <>
          <Source
            id={`coverage-tiles-source-${providerId}`}
            minzoom={meta.coverageTiles.minZoom}
            tileSize={meta.coverageTiles.tileSize}
            tiles={[meta.coverageTiles.url]}
            type="raster"
          />
          <Layer
            id={`coverage-tiles-${providerId}`}
            minzoom={meta.coverageTiles.minZoom}
            paint={{ 'raster-opacity': 0.7 }}
            source={`coverage-tiles-source-${providerId}`}
            type="raster"
          />
        </>
      ) : null}
      {adapter?.fetchSequences && showSequences ? (
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
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
              'line-sort-key': ['case', inActiveSequence, 1, 0],
            }}
            paint={{
              'line-color': lineAndDotColor,
              'line-width': ['case', inActiveSequence, ACTIVE_LINE_WIDTH, 1.25],
              'line-opacity': lineOpacity,
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
            filter={notShownPhoto}
            paint={{
              'fill-color': photoCircleColor,
              'fill-opacity': viewShapeOpacity(VIEW_SHAPE_FILL_OPACITY),
              'fill-outline-color': 'rgba(0, 0, 0, 0)',
            }}
          />
          {/* A hairline, just enough to give overlapping shapes an edge. */}
          <Layer
            id={viewfieldLineLayerId(providerId)}
            type="line"
            source={viewfieldSrcId}
            filter={notShownPhoto}
            paint={{
              'line-color': photoCircleColor,
              'line-width': 0.5,
              'line-opacity': viewShapeOpacity(0.3),
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
          'circle-radius': dotRadius,
          'circle-color': lineAndDotColor,
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
  const meta = providerById[providerId]
  const { data: features = [] } = useProviderMapFeatures(providerId, bbox, zoom)

  const valueFilter = filter?.mapFeatureValue
  const featureCollection =
    zoom >= meta.minZoom
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
        }}
      />
    </>
  )
}

const ProviderLayer = (props: ProviderLayerProps) => {
  return providerById[props.providerId].kind === 'mapFeature' ? (
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
    /** Heading wedges / 360° disks per photo, from zoom 17, capped for dense areas. Default true. */
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
    /**
     * Style colour of a photo (by type, age …). It colours the view-direction shapes; photo dots
     * and sequence lines are black.
     */
    photoCircleColor: DataDrivenPropertyValueSpecification<string>
    /** Colour of the shown photo's view cone. Default: the selection colour (orange). */
    viewConeColor?: DataDrivenPropertyValueSpecification<string>
    /** Length of the shown photo's view cone, as a multiple of the per-photo shapes. Default 2.5. */
    viewConeScale?: number
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
    viewConeColor,
    viewConeScale,
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

  const activeSequenceId = selectedSequenceId ?? selectedPhoto?.sequenceId
  const selectedSequence = resolveSelectedSequence(selectedPhoto, sequences, activeSequenceId)
  // The provider's own sequence layer marks the shown sequence. Without that layer (provider
  // off, sequences off) the overlay draws the line.
  const providerDrawsSequences =
    selectedProviderId != null && showSequences && providers.includes(selectedProviderId)

  // The shown photo's sequence goes below the lowest photo layer, so dots stay on top of it.
  const firstPhotoProvider = providers.find(
    (id) => providerById[id].kind === 'photo' && adapterById[id]?.fetchPhotos,
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
            activeSequenceId={providerId === selectedProviderId ? activeSequenceId : null}
            hasActiveSequence={activeSequenceId != null}
            shownPhotoId={
              showViewCone && providerId === selectedProviderId ? selectedPhoto?.photoId : null
            }
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
          color={viewConeColor ?? SELECTION_COLOR}
          scale={viewConeScale}
          selectedPhoto={selectedPhoto}
          viewerPov={viewerPov}
          zoom={zoom}
        />
      ) : null}

      {showSelectionHighlight ? (
        <StreetLevelImagerySelectionOverlay
          cameraLngLat={viewerPov?.lngLat}
          selectedPhoto={selectedPhoto}
          selectedSequence={providerDrawsSequences ? null : selectedSequence}
          sequenceBeforeId={sequenceBeforeId}
        />
      ) : null}
    </>
  )
}
