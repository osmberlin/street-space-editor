import type { Feature } from 'geojson'
import { pointLngLat } from '../fetchMvt'
import { NORWAY_BBOX } from '../meta'
import type { Bbox, NormalizedPhoto, ProviderAdapter, TileCoord } from '../model'
import { collectSettledTiles, fetchTileCached, getTileCacheKey } from '../tileCache'
import { bboxIntersects, tileBbox, tilesForBbox } from '../tileMath'

const TILE_ZOOM = 14
const OWS_BASE = 'https://www.vegvesen.no/kart/ogc/vegbilder_1_0/ows'
const CAPABILITIES_URL = `${OWS_BASE}?service=WFS&request=GetCapabilities&version=2.0.0`
const LAYER_NAME_REGEX = /vegbilder_1_0:Vegbilder(_360)?_(\d{4})/g

export type VegbilderLayerInfo = {
  name: string
  is360: boolean
  year: number
}

type WfsFeatureCollection = {
  features?: Feature[]
}

export const parseVegbilderLayerNames = (capabilitiesXml: string): VegbilderLayerInfo[] => {
  const layers: VegbilderLayerInfo[] = []
  const seen = new Set<string>()

  for (const match of capabilitiesXml.matchAll(LAYER_NAME_REGEX)) {
    const name = match[0]
    if (seen.has(name)) {
      continue
    }
    seen.add(name)
    layers.push({
      name,
      is360: match[1] === '_360',
      year: Number(match[2]),
    })
  }

  return layers
}

export const selectVegbilderLayers = (
  layers: VegbilderLayerInfo[],
  minYear = 2020,
  maxLayers = 8,
): string[] =>
  layers
    .filter((layer) => layer.year >= minYear)
    .sort((a, b) => b.year - a.year || Number(a.is360) - Number(b.is360))
    .slice(0, maxLayers)
    .map((layer) => layer.name)

export const parseVegbilderTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null
  }
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

export const buildVegbilderSequenceId = (props: Record<string, unknown>): string | null => {
  const fylke = props.FYLKENUMMER
  const category = props.VEGKATEGORI
  const number = props.VEGNUMMER
  if (
    (typeof fylke !== 'string' && typeof fylke !== 'number') ||
    typeof category !== 'string' ||
    (typeof number !== 'string' && typeof number !== 'number')
  ) {
    return null
  }
  return `${fylke}-${category}-${number}`
}

export const normalizeVegbilderFeature = (
  feature: Feature,
  layerYear?: number,
): Omit<NormalizedPhoto, 'providerId'> | null => {
  const lngLat = pointLngLat(feature)
  if (!lngLat) {
    return null
  }

  const id = feature.id
  if (id == null) {
    return null
  }

  const props = feature.properties ?? {}
  const heading =
    props.RETNING == null
      ? null
      : typeof props.RETNING === 'number'
        ? props.RETNING
        : Number.parseFloat(String(props.RETNING))

  const previewPath = props.URLPREVIEW
  const thumbUrl =
    typeof previewPath === 'string' && previewPath.length > 0 ? previewPath : undefined
  const fullPath = props.URL
  const fullUrl = typeof fullPath === 'string' && fullPath.length > 0 ? fullPath : undefined

  const yearFromTimestamp = (() => {
    const capturedAt = parseVegbilderTimestamp(props.TIDSPUNKT)
    return capturedAt != null ? new Date(capturedAt).getUTCFullYear() : undefined
  })()

  return {
    photoId: String(id),
    sequenceId: buildVegbilderSequenceId(props),
    capturedAt: parseVegbilderTimestamp(props.TIDSPUNKT),
    isPano: props.BILDETYPE === '360',
    heading: heading != null && !Number.isNaN(heading) ? heading : null,
    lngLat,
    thumbUrl,
    fullUrl,
    viewerYear: layerYear ?? yearFromTimestamp,
  }
}

export const intersectsNorway = (bbox: Bbox): boolean => bboxIntersects(bbox, NORWAY_BBOX)

let capabilitiesPromise: Promise<VegbilderLayerInfo[]> | null = null

const loadCapabilities = (signal: AbortSignal): Promise<VegbilderLayerInfo[]> => {
  if (!capabilitiesPromise) {
    capabilitiesPromise = (async () => {
      const response = await fetch(CAPABILITIES_URL, { signal })
      if (!response.ok) {
        throw new Error(`Vegbilder capabilities failed (${response.status})`)
      }
      return parseVegbilderLayerNames(await response.text())
    })().catch((error) => {
      capabilitiesPromise = null
      throw error
    })
  }
  return capabilitiesPromise
}

const wfsFeatureUrl = (layer: string, bbox: Bbox) => {
  const [west, south, east, north] = bbox
  const params = new URLSearchParams({
    service: 'WFS',
    request: 'GetFeature',
    version: '2.0.0',
    typenames: layer,
    bbox: `${south},${west},${north},${east}`,
    outputFormat: 'json',
  })
  return `${OWS_BASE}?${params.toString()}`
}

const fetchWfsLayer = async (
  layer: string,
  bbox: Bbox,
  signal: AbortSignal,
): Promise<Feature[]> => {
  const response = await fetch(wfsFeatureUrl(layer, bbox), { signal })
  if (!response.ok) {
    throw new Error(`Vegbilder WFS failed (${response.status}): ${layer}`)
  }
  const data = (await response.json()) as WfsFeatureCollection
  return data.features ?? []
}

type VegbilderLayerFeatures = {
  layer: string
  year: number
  features: Feature[]
}

const fetchVegbilderTile = async (
  tile: TileCoord,
  layers: VegbilderLayerInfo[],
  signal: AbortSignal,
): Promise<VegbilderLayerFeatures[]> => {
  const key = getTileCacheKey('vegbilder', tile)
  return fetchTileCached(
    key,
    async (innerSignal) => {
      const bbox = tileBbox(tile)
      return Promise.all(
        layers.map(async (layer) => ({
          layer: layer.name,
          year: layer.year,
          features: await fetchWfsLayer(layer.name, bbox, innerSignal),
        })),
      )
    },
    signal,
  )
}

const fetchPhotos = async (bbox: Bbox, _zoom: number, signal: AbortSignal) => {
  if (!intersectsNorway(bbox)) {
    return []
  }

  const allLayers = await loadCapabilities(signal)
  const selectedLayerNames = selectVegbilderLayers(allLayers)
  const layers = allLayers.filter((layer) => selectedLayerNames.includes(layer.name))
  if (layers.length === 0) {
    return []
  }

  const tiles = tilesForBbox(bbox, TILE_ZOOM)
  const tileFeatures = await collectSettledTiles(
    tiles.map((tile) => fetchVegbilderTile(tile, layers, signal)),
  )

  const photos: NormalizedPhoto[] = []
  for (const tileLayers of tileFeatures) {
    for (const { features, year } of tileLayers) {
      for (const feature of features) {
        const normalized = normalizeVegbilderFeature(feature, year)
        if (normalized) {
          photos.push({ providerId: 'vegbilder', ...normalized })
        }
      }
    }
  }

  return photos
}

export const vegbilderAdapter: ProviderAdapter = {
  id: 'vegbilder',
  fetchPhotos,
}
