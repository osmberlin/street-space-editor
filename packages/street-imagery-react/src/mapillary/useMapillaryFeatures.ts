import {
  bboxAround,
  bestTargetImage,
  distanceMeters,
  fetchImageDetections,
  fetchMapFeatureImages,
  fetchMapillaryMapFeaturesInBbox,
  SIGN_TARGET,
  type LngLat,
  type TargetShape,
} from '@osm-editor-kit/street-imagery'
import { useQuery } from '@tanstack/react-query'

const STALE_TIME = 10 * 60 * 1000

/**
 * A Mapillary map feature (sign, traffic light, marking) with all images that show it, grouped by
 * day, and the outlines Mapillary linked to it. Feed `days[0].best` into the viewer with
 * `lookAt={{ lngLat: feature.lngLat, outline: image.outline }}`.
 */
export const useMapillaryMapFeatureImages = (
  featureId: string | null | undefined,
  { shape = SIGN_TARGET }: { shape?: TargetShape } = {},
) =>
  useQuery({
    queryKey: ['street-imagery', 'mapillary-map-feature', featureId, shape],
    queryFn: ({ signal }) => fetchMapFeatureImages(featureId as string, { shape, signal }),
    enabled: !!featureId,
    staleTime: STALE_TIME,
  })

/**
 * Map features within `radiusMeters` of a point (Graph API), nearest first, e.g. the traffic
 * lights and markings at a junction. `objectValues` accepts wildcards (`object--traffic-light--*`).
 */
export const useMapillaryMapFeaturesNear = (
  lngLat: LngLat | null | undefined,
  {
    radiusMeters = 40,
    objectValues,
    enabled = true,
  }: { radiusMeters?: number; objectValues?: string[]; enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: ['street-imagery', 'mapillary-map-features-near', lngLat, radiusMeters, objectValues],
    queryFn: async ({ signal }) => {
      const center = lngLat as LngLat
      const features = await fetchMapillaryMapFeaturesInBbox(bboxAround(center, radiusMeters), {
        objectValues,
        signal,
      })
      return features
        .map((feature) => ({ ...feature, distanceMeters: distanceMeters(center, feature.lngLat) }))
        .filter((feature) => feature.distanceMeters <= radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
    },
    enabled: enabled && !!lngLat,
    staleTime: STALE_TIME,
  })

/**
 * Detection outlines of one image, for `outlines` of the Mapillary viewer. An image has ~500
 * detections; pass `filter` (e.g. `matchesAnyGroup(JUNCTION_DETECTION_GROUPS)`) and name it with
 * `filterKey` so the cache can tell filters apart.
 */
export const useMapillaryImageDetections = (
  imageId: string | null | undefined,
  { filter, filterKey }: { filter?: (value: string) => boolean; filterKey?: string } = {},
) =>
  useQuery({
    queryKey: ['street-imagery', 'mapillary-detections', imageId, filterKey ?? null],
    queryFn: ({ signal }) => fetchImageDetections(imageId as string, { filter, signal }),
    enabled: !!imageId,
    staleTime: STALE_TIME,
  })

/**
 * A selected Mapillary map feature (sign, object) for a host's feature + photo selection: all its
 * photos by day, the photo that is shown (`shownPhotoId`), and the one to open first — the best of
 * the newest day, from within `minCapturedAt` (ms) when set. Feed `data` and `shownImage` to
 * `MapillaryFeatureBar` and `SelectedMapFeatureLayer`, and `shownImage.outline` to `lookAt`.
 */
export const useSelectedMapillaryFeature = ({
  featureId,
  shownPhotoId,
  minCapturedAt,
  shape,
}: {
  featureId: string | null | undefined
  shownPhotoId?: string | null
  minCapturedAt?: number | null
  shape?: TargetShape
}) => {
  const { data, isLoading, isError } = useMapillaryMapFeatureImages(featureId, { shape })
  const shownImage = data?.images.find((image) => image.id === shownPhotoId) ?? null
  const firstImage = data
    ? (bestTargetImage(data.images, data.feature.lngLat, {
        minCapturedAt: minCapturedAt ?? undefined,
        shape,
      }) ?? null)
    : null
  return { data: data ?? null, isLoading, isError, shownImage, firstImage }
}
