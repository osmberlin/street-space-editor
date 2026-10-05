import type { NormalizedPhoto, PhotoDetails } from '@osm-editor-kit/street-imagery'

/** The parts of a Panoramax picture (a STAC item of `/api/search`) the viewer reads. */
export type PanoramaxItem = {
  id: string
  collection?: string
  geometry: { type: 'Point'; coordinates: [number, number] }
  links?: {
    rel: string
    href?: string
    /** `prev` and `next` name the neighbour in the sequence. */
    id?: string
    /** `via` names the server the picture is stored on. */
    instance_name?: string
  }[]
  assets?: Partial<Record<'hd' | 'sd' | 'thumb', { href: string }>>
  providers?: { name: string; roles?: string[] }[]
  properties?: {
    datetime?: string
    datetimetz?: string
    created?: string
    license?: string
    exif?: Record<string, unknown>
    'view:azimuth'?: number | null
    'geovisio:producer'?: string
    'geovisio:rank_in_collection'?: number
    'original_file:name'?: string
    'original_file:size'?: number
    'quality:horizontal_accuracy'?: number
    'pers:interior_orientation'?: {
      camera_manufacturer?: string
      camera_model?: string
      focal_length?: number
      /** Horizontal field of view in degrees; 360 for a 360° picture. */
      field_of_view?: number | null
      /** Width and height of the picture in pixels. */
      sensor_array_dimensions?: [number, number]
    }
  }
}

/** Horizontal field of view assumed for a flat picture that does not state one. */
const DEFAULT_FIELD_OF_VIEW_DEG = 70

const toMs = (iso: string | undefined): number | null => {
  const ms = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(ms) ? null : ms
}

const orientation = (item: PanoramaxItem) => item.properties?.['pers:interior_orientation']

export const isPanoramaxItemSpherical = (item: PanoramaxItem) =>
  orientation(item)?.field_of_view === 360

/** Width and height in pixels; a guess when the picture does not state them. */
export const panoramaxItemSize = (item: PanoramaxItem): [number, number] =>
  orientation(item)?.sensor_array_dimensions ?? (isPanoramaxItemSpherical(item) ? [2, 1] : [4, 3])

/** Neighbour in the sequence, from the item's `prev` / `next` link. */
export const panoramaxItemNeighbour = (item: PanoramaxItem, rel: 'prev' | 'next') =>
  item.links?.find((link) => link.rel === rel)?.id ?? null

/** Width in pixels of the `sd` file every picture has. */
const SD_WIDTH = 2048

/** The file a picture opens with: `sd`, 2048 px wide. */
export const panoramaxItemImageUrl = (item: PanoramaxItem): string => {
  const { hd, sd, thumb } = item.assets ?? {}
  return sd?.href ?? hd?.href ?? thumb?.href ?? ''
}

// mapillary-js cuts a picture into tiles of 1024 px. At the highest level (the power of two that
// holds the longer side) a tile is 1024 px of the original; each level below halves the picture.
const TILE_SIZE = 1024

type PictureSize = [width: number, height: number]

/** Pixels of the original that one tile of level `z` covers along a side. */
const tileSpan = ([width, height]: PictureSize, z: number) =>
  TILE_SIZE * 2 ** (Math.ceil(Math.log2(Math.max(width, height))) - z)

/**
 * The size to tell mapillary-js: the real proportions, with the longer side raised to the next
 * power of two. Its tile levels halve from that power of two, so a picture of 8704 px would get
 * levels of 4352, 2176, 1088 px, the low ones coarser than the `sd` file. This way they are
 * 8192, 4096, 2048 px.
 */
export const panoramaxViewerSize = (item: PanoramaxItem): PictureSize => {
  const [width, height] = panoramaxItemSize(item)
  const scale = 2 ** Math.ceil(Math.log2(Math.max(width, height))) / Math.max(width, height)
  return [Math.round(width * scale), Math.round(height * scale)]
}

/** Whether level `z` shows more detail than the `sd` file; only then the original is needed. */
export const panoramaxLevelNeedsOriginal = (size: PictureSize, z: number) =>
  size[0] / (tileSpan(size, z) / TILE_SIZE) > SD_WIDTH

/** The tiles of a picture at level `z`. */
export const panoramaxTilesOfLevel = (size: PictureSize, z: number): { x: number; y: number }[] => {
  const [width, height] = size
  const span = tileSpan(size, z)
  const tiles: { x: number; y: number }[] = []
  for (let y = 0; y < Math.ceil(height / span); y++) {
    for (let x = 0; x < Math.ceil(width / span); x++) {
      tiles.push({ x, y })
    }
  }
  return tiles
}

/**
 * Where to cut a tile from a file of the picture, and how large to draw it. `original` is the
 * size of that file; the cut is scaled when it differs from the stated `size`.
 */
export const panoramaxTileRect = (
  size: PictureSize,
  tile: { x: number; y: number; z: number },
  original: { width: number; height: number },
) => {
  const [width, height] = size
  const span = tileSpan(size, tile.z)
  const x = tile.x * span
  const y = tile.y * span
  const cutWidth = Math.min(span, width - x)
  const cutHeight = Math.min(span, height - y)
  const scaleX = original.width / width
  const scaleY = original.height / height
  return {
    x: x * scaleX,
    y: y * scaleY,
    width: cutWidth * scaleX,
    height: cutHeight * scaleY,
    outWidth: Math.max(1, Math.round((cutWidth / span) * TILE_SIZE)),
    outHeight: Math.max(1, Math.round((cutHeight / span) * TILE_SIZE)),
  }
}

/**
 * Focal length of a flat picture as mapillary-js wants it: relative to the longer side. A
 * picture without a field of view gets a common one.
 */
export const panoramaxItemFocal = (item: PanoramaxItem): number => {
  const fieldOfView = orientation(item)?.field_of_view || DEFAULT_FIELD_OF_VIEW_DEG
  const [width, height] = panoramaxItemSize(item)
  const focalByWidth = 0.5 / Math.tan((Math.min(fieldOfView, 170) * Math.PI) / 360)
  return focalByWidth * (width / Math.max(width, height))
}

const creatorOf = (item: PanoramaxItem) =>
  item.properties?.['geovisio:producer'] ?? item.providers?.at(-1)?.name

/** The picture as a photo with creator, licence, local capture time and camera. */
export const panoramaxPhotoFromItem = (item: PanoramaxItem): NormalizedPhoto => {
  const properties = item.properties ?? {}
  const camera = orientation(item)
  const cameraName = [camera?.camera_manufacturer, camera?.camera_model].filter(Boolean).join(' ')
  const isPano = isPanoramaxItemSpherical(item)
  const creatorName = creatorOf(item)
  const uploadedAt = toMs(properties.created)
  const licenseUrl = item.links?.find((link) => link.rel === 'license')?.href
  const instance = item.links?.find((link) => link.rel === 'via')?.instance_name
  const exifEntries = Object.entries(properties.exif ?? {})
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => [key, String(value)] as const)

  const details: PhotoDetails = {
    ...(properties.license ? { license: properties.license } : {}),
    ...(licenseUrl ? { licenseUrl } : {}),
    ...(properties.datetimetz ? { capturedAtLocal: properties.datetimetz } : {}),
    ...(uploadedAt != null ? { uploadedAt } : {}),
    ...(cameraName ? { camera: cameraName } : {}),
    ...(!isPano && camera?.field_of_view ? { fieldOfViewDeg: camera.field_of_view } : {}),
    ...(properties['quality:horizontal_accuracy'] != null
      ? { positionAccuracyMeters: properties['quality:horizontal_accuracy'] }
      : {}),
    ...(instance ? { instance } : {}),
    ...(camera?.focal_length != null ? { focalLengthMm: camera.focal_length } : {}),
    ...(properties['original_file:name']
      ? { originalFileName: properties['original_file:name'] }
      : {}),
    ...(properties['original_file:size'] != null
      ? { originalFileSizeBytes: properties['original_file:size'] }
      : {}),
    ...(properties['geovisio:rank_in_collection'] != null
      ? { rankInSequence: properties['geovisio:rank_in_collection'] }
      : {}),
    ...(exifEntries.length > 0 ? { exif: Object.fromEntries(exifEntries) } : {}),
  }

  return {
    providerId: 'panoramax',
    photoId: item.id,
    sequenceId: item.collection ?? null,
    capturedAt: toMs(properties.datetime),
    isPano,
    heading: properties['view:azimuth'] ?? null,
    lngLat: item.geometry.coordinates,
    ...(creatorName ? { creatorName } : {}),
    details,
  }
}
