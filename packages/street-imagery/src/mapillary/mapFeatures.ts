import type { Bbox } from '../providers/model'
import type { LngLat } from '../viewpoints/geometry'
import { fetchMapFeatureDetections } from './detections'
import { mapillaryGraphGet } from './graphApi'
import { fetchMapillaryImages } from './imageInfo'
import {
  SIGN_TARGET,
  targetImagesByDay,
  type TargetImage,
  type TargetImageDay,
  type TargetShape,
} from './targetView'

type GraphMapFeature = {
  id: string
  object_value?: string
  geometry?: { coordinates: LngLat }
  first_seen_at?: string
  last_seen_at?: string
  aligned_direction?: number
  images?: { data: { id: string }[] }
}

export type MapillaryMapFeature = {
  id: string
  /** Mapillary value, e.g. `object--traffic-light--general-upright`. */
  value: string
  lngLat: LngLat
  /** ms */
  firstSeenAt: number | null
  lastSeenAt: number | null
  /** Where the object's face points (degrees); traffic it applies to travels the opposite way. */
  facing: number | null
  /** Ids of the images the feature was derived from (only with `images: true`). */
  imageIds: string[]
}

const FEATURE_FIELDS = 'id,object_value,geometry,first_seen_at,last_seen_at,aligned_direction'

const parseDate = (value: string | undefined): number | null => {
  const ms = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(ms) ? null : ms
}

const normalizeMapFeature = (feature: GraphMapFeature): MapillaryMapFeature | null =>
  feature.geometry
    ? {
        id: String(feature.id),
        value: feature.object_value ?? '',
        lngLat: feature.geometry.coordinates,
        firstSeenAt: parseDate(feature.first_seen_at),
        lastSeenAt: parseDate(feature.last_seen_at),
        facing: feature.aligned_direction ?? null,
        imageIds: (feature.images?.data ?? []).map((image) => String(image.id)),
      }
    : null

/** One map feature with the ids of all images that show it. */
export const fetchMapillaryMapFeature = async (
  featureId: string,
  signal?: AbortSignal,
): Promise<MapillaryMapFeature | null> =>
  normalizeMapFeature(
    await mapillaryGraphGet<GraphMapFeature>(
      featureId,
      { fields: `${FEATURE_FIELDS},images` },
      signal,
    ),
  )

/** Mapillary limit for `bbox` searches: smaller than 0.01° on each side; up to 2000 results. */
export const MAPILLARY_BBOX_MAX_DEGREES = 0.01

/**
 * Map features in a small bbox (Graph API). Unlike the vector tiles this gives `facing`, and
 * with `images: true` the image ids per feature. `objectValues` accepts wildcards
 * (`object--traffic-light--*`, `marking--discrete--*`).
 */
export const fetchMapillaryMapFeaturesInBbox = async (
  bbox: Bbox,
  {
    objectValues,
    images = false,
    signal,
  }: { objectValues?: string[]; images?: boolean; signal?: AbortSignal } = {},
): Promise<MapillaryMapFeature[]> => {
  const params: Record<string, string> = {
    bbox: bbox.join(','),
    fields: images ? `${FEATURE_FIELDS},images` : FEATURE_FIELDS,
  }
  if (objectValues?.length) {
    params.object_values = objectValues.join(',')
  }
  const result = await mapillaryGraphGet<{ data: GraphMapFeature[] }>(
    'map_features',
    params,
    signal,
  )
  return result.data.flatMap((feature) => normalizeMapFeature(feature) ?? [])
}

/** Small bbox around a point, e.g. a junction (`radiusMeters` up to ~500). */
export const bboxAround = ([lng, lat]: LngLat, radiusMeters: number): Bbox => {
  const dLat = radiusMeters / 111_320
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6)
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat]
}

export type MapFeatureImages = {
  feature: MapillaryMapFeature
  /** All images that show the feature, with the feature's outline where Mapillary has one. */
  images: TargetImage[]
  /** Grouped by capture day, newest first, best image first. */
  days: TargetImageDay[]
  /** Detection id per image id, to highlight that outline in the viewer. */
  detectionIdByImageId: Map<string, string>
}

/**
 * A map feature with everything needed to show it in photos: all its images with dates and the
 * outlines Mapillary linked to it (usually only for a few of the images).
 */
export const fetchMapFeatureImages = async (
  featureId: string,
  { shape = SIGN_TARGET, signal }: { shape?: TargetShape; signal?: AbortSignal } = {},
): Promise<MapFeatureImages | null> => {
  const feature = await fetchMapillaryMapFeature(featureId, signal)
  if (!feature) {
    return null
  }
  const [details, detections] = await Promise.all([
    fetchMapillaryImages(feature.imageIds, signal),
    // Without outlines the view is computed from the locations.
    fetchMapFeatureDetections(featureId, signal).catch(() => []),
  ])
  const outlineByImageId = new Map(detections.map((d) => [d.imageId, d.outline]))
  const images = details.flatMap((image): TargetImage[] =>
    image.lngLat && image.capturedAt != null
      ? [
          {
            id: image.id,
            lngLat: image.lngLat,
            originalLngLat: image.originalLngLat,
            capturedAt: image.capturedAt,
            isPano: image.isPano,
            username: image.username,
            outline: outlineByImageId.get(image.id),
          },
        ]
      : [],
  )
  return {
    feature,
    images,
    days: targetImagesByDay(images, feature.lngLat, shape),
    detectionIdByImageId: new Map(detections.map((d) => [d.imageId, d.id])),
  }
}
