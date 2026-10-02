import type { Feature } from 'geojson'
import { getStreetImageryConfig } from '../../config'
import { fetchMvt, pointLngLat } from '../fetchMvt'
import type {
  Bbox,
  NormalizedPhoto,
  NormalizedSequence,
  ProviderAdapter,
  TileCoord,
} from '../model'
import { collectSettledTiles, fetchTileCached, getTileCacheKey } from '../tileCache'
import { clampZoom, tilesForBbox } from '../tileMath'

const PHOTO_TILE_MAX_ZOOM = 15
const SEQUENCE_TILE_MIN_ZOOM = 10
const SEQUENCE_TILE_MAX_ZOOM = 15

const tileUrl = (tile: TileCoord) => {
  const base = getStreetImageryConfig().panoramaxApiBase
  return `${base}/api/map/${tile.z}/${tile.x}/${tile.y}.mvt`
}

export const parsePanoramaxTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export const normalizePanoramaxPictureFeature = (
  feature: Feature,
): Omit<NormalizedPhoto, 'providerId'> | null => {
  const lngLat = pointLngLat(feature)
  if (!lngLat) {
    return null
  }

  const props = feature.properties ?? {}
  const id = props.id
  if (id == null) {
    return null
  }

  const heading =
    props.heading == null
      ? null
      : typeof props.heading === 'number'
        ? props.heading
        : Number.parseInt(String(props.heading), 10)

  return {
    photoId: String(id),
    sequenceId: props.first_sequence != null ? String(props.first_sequence) : null,
    capturedAt: parsePanoramaxTimestamp(props.ts),
    isPano: props.type === 'equirectangular',
    heading: heading != null && !Number.isNaN(heading) ? heading : null,
    lngLat,
  }
}

export const normalizePanoramaxSequenceFeature = (
  feature: Feature,
): Omit<NormalizedSequence, 'providerId'> | null => {
  const props = feature.properties ?? {}
  const id = props.id
  if (id == null) {
    return null
  }

  const { geometry } = feature
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
    return null
  }

  return {
    sequenceId: String(id),
    geometry,
    capturedAt: parsePanoramaxTimestamp(props.ts ?? props.datetime ?? props.date),
    isPano: null,
  }
}

const fetchPanoramaxTile = async (tile: TileCoord, signal: AbortSignal) => {
  const key = getTileCacheKey('panoramax', tile)
  return fetchTileCached(key, (innerSignal) => fetchMvt(tileUrl(tile), tile, innerSignal), signal)
}

const fetchPanoramaxTiles = async (bbox: Bbox, zoom: number, signal: AbortSignal) => {
  const tileZoom = clampZoom(zoom, SEQUENCE_TILE_MIN_ZOOM, SEQUENCE_TILE_MAX_ZOOM)
  const tiles = tilesForBbox(bbox, tileZoom)
  return collectSettledTiles(tiles.map((tile) => fetchPanoramaxTile(tile, signal)))
}

const fetchPhotos = async (bbox: Bbox, zoom: number, signal: AbortSignal) => {
  const tileZoom = clampZoom(zoom, PHOTO_TILE_MAX_ZOOM, PHOTO_TILE_MAX_ZOOM)
  const tiles = tilesForBbox(bbox, tileZoom)
  const tileLayers = await collectSettledTiles(
    tiles.map((tile) => fetchPanoramaxTile(tile, signal)),
  )
  const photos: NormalizedPhoto[] = []

  for (const layers of tileLayers) {
    const pictureFeatures = layers.pictures ?? []
    for (const feature of pictureFeatures) {
      const normalized = normalizePanoramaxPictureFeature(feature)
      if (normalized) {
        photos.push({ providerId: 'panoramax', ...normalized })
      }
    }
  }

  return photos
}

const fetchSequences = async (bbox: Bbox, zoom: number, signal: AbortSignal) => {
  const tileLayers = await fetchPanoramaxTiles(bbox, zoom, signal)
  const sequences: NormalizedSequence[] = []

  for (const layers of tileLayers) {
    const sequenceFeatures = layers.sequences ?? []
    for (const feature of sequenceFeatures) {
      const normalized = normalizePanoramaxSequenceFeature(feature)
      if (normalized) {
        sequences.push({ providerId: 'panoramax', ...normalized })
      }
    }
  }

  return sequences
}

export const panoramaxAdapter: ProviderAdapter = {
  id: 'panoramax',
  fetchPhotos,
  fetchSequences,
}
