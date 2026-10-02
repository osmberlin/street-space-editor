import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import { mapillaryGraphGet } from './graphApi'

export type MapillaryDetection = {
  id: string
  /** Mapillary value, e.g. `construction--flat--bike-lane`, `regulatory--bicycles-only--g1`. */
  value: string
  imageId: string
  /** Outline in image ("basic") coordinates, `[0, 0]` top left to `[1, 1]` bottom right. */
  outline: [number, number][]
}

/**
 * Outline of a detection: the API's `geometry` is a base64 vector tile (layer `mpy-or`) in image
 * coordinates. Returns an empty outline for data that cannot be decoded.
 */
export const decodeDetectionOutline = (geometry: string): [number, number][] => {
  try {
    const binary = atob(geometry)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    const layer = new VectorTile(new PbfReader(bytes.buffer)).layers['mpy-or']
    const ring = layer?.feature(0).loadGeometry()[0]
    if (!layer || !ring) {
      return []
    }
    return ring.map((point) => [point.x / layer.extent, point.y / layer.extent])
  } catch {
    return []
  }
}

type DetectionResponse = {
  data: { id: string; value?: string; geometry: string; image?: { id: string } }[]
}

/**
 * Everything Mapillary detected in an image (often ~500 outlines: road, cars, trees …).
 * Pass `filter` to keep only the values you show, e.g. bike lanes and markings.
 */
export const fetchImageDetections = async (
  imageId: string,
  { filter, signal }: { filter?: (value: string) => boolean; signal?: AbortSignal } = {},
): Promise<MapillaryDetection[]> => {
  const result = await mapillaryGraphGet<DetectionResponse>(
    `${imageId}/detections`,
    { fields: 'id,value,geometry' },
    signal,
  )
  return result.data
    .filter((detection) => !filter || filter(detection.value ?? ''))
    .map((detection) => ({
      id: detection.id,
      value: detection.value ?? '',
      imageId,
      outline: decodeDetectionOutline(detection.geometry),
    }))
    .filter((detection) => detection.outline.length > 0)
}

/** The detections a map feature was derived from: one outline per image that has one. */
export const fetchMapFeatureDetections = async (
  featureId: string,
  signal?: AbortSignal,
): Promise<MapillaryDetection[]> => {
  const result = await mapillaryGraphGet<DetectionResponse>(
    `${featureId}/detections`,
    { fields: 'id,geometry,image' },
    signal,
  )
  return result.data.flatMap((detection) => {
    const outline = decodeDetectionOutline(detection.geometry)
    return detection.image && outline.length > 0
      ? [{ id: detection.id, value: '', imageId: detection.image.id, outline }]
      : []
  })
}
