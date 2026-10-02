import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { Bbox, NormalizedPhoto } from '../providers/model'
import { viewShapeRadiusMeters } from './viewCone'

/** Narrow heading wedge for flat (directional) photos — iD-style viewfield. */
export const FLAT_VIEWFIELD_FOV_DEG = 55

/** Full disk for 360° / equirectangular photos. */
export const PANO_VIEWFIELD_FOV_DEG = 360

/** Viewfields only make sense (and stay cheap) when zoomed in on a few streets. */
export const VIEWFIELD_MIN_ZOOM = 17

/** Upper bound of viewfield polygons per provider; dense areas would otherwise freeze the map. */
export const VIEWFIELD_MAX_FEATURES = 1500

/** Corners of a 360° disk: enough to look round at its size on screen (about 17 px radius). */
const PANO_DISK_SEGMENTS = 32

const METERS_PER_DEGREE_LAT = 111_320

const normalizeBearing = (bearingDeg: number): number => ((bearingDeg % 360) + 360) % 360

const offsetMeters = (
  lng: number,
  lat: number,
  bearingDeg: number,
  distanceMeters: number,
): [number, number] => {
  const bearingRad = (bearingDeg * Math.PI) / 180
  const northMeters = Math.cos(bearingRad) * distanceMeters
  const eastMeters = Math.sin(bearingRad) * distanceMeters
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.max(cosLat, 1e-6)

  return [lng + eastMeters / metersPerDegreeLng, lat + northMeters / METERS_PER_DEGREE_LAT]
}

/** Lightweight triangle wedge (apex + left/right rays) for dense coverage layers. */
export const flatViewfieldTriangle = (
  lngLat: [number, number],
  bearingDeg: number,
  fovDeg: number,
  radiusMeters: number,
): Feature<Polygon> => {
  const [lng, lat] = lngLat
  const center = normalizeBearing(bearingDeg)
  const half = Math.max(fovDeg, 0) / 2
  const left = offsetMeters(lng, lat, center - half, radiusMeters)
  const right = offsetMeters(lng, lat, center + half, radiusMeters)

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[lng, lat], left, right, [lng, lat]]],
    },
  }
}

const panoDisk = (lngLat: [number, number], radiusMeters: number): Polygon => {
  const ring: [number, number][] = []
  for (let index = 0; index <= PANO_DISK_SEGMENTS; index += 1) {
    ring.push(offsetMeters(lngLat[0], lngLat[1], (index * 360) / PANO_DISK_SEGMENTS, radiusMeters))
  }
  return { type: 'Polygon', coordinates: [ring] }
}

const inBbox = ([lng, lat]: [number, number], [west, south, east, north]: Bbox) =>
  lng >= west && lng <= east && lat >= south && lat <= north

export type ViewfieldOptions = {
  /** Only photos inside this bbox (providers load whole tiles, far beyond the viewport). */
  bbox?: Bbox | null
  /** Newest photos win when there are more. Default `VIEWFIELD_MAX_FEATURES`. */
  maxFeatures?: number
}

export type ViewfieldPhotoProps = {
  providerId: string
  photoId: string
  sequenceId: string | null
  capturedAt: number | null
  isPano: boolean | null
  heading: number | null
}

/**
 * Build viewfield polygons for every photo that can show direction:
 * - panorama → full 360° disk
 * - flat with heading → narrow triangle wedge
 * Photos without heading that are not panos are skipped.
 */
export const photosToViewfieldsFeatureCollection = (
  photos: NormalizedPhoto[],
  zoom: number,
  { bbox, maxFeatures = VIEWFIELD_MAX_FEATURES }: ViewfieldOptions = {},
): FeatureCollection<Polygon, ViewfieldPhotoProps> => {
  // Half-zoom steps: sizes barely change in between, and callers can reuse the result.
  const radius = viewShapeRadiusMeters(Math.floor(zoom * 2) / 2)
  const features: Feature<Polygon, ViewfieldPhotoProps>[] = []

  const inView = bbox ? photos.filter((photo) => inBbox(photo.lngLat, bbox)) : photos
  const selected =
    inView.length > maxFeatures
      ? [...inView].sort((a, b) => (b.capturedAt ?? 0) - (a.capturedAt ?? 0)).slice(0, maxFeatures)
      : inView

  for (const photo of selected) {
    const isPano = photo.isPano === true
    if (!isPano && photo.heading == null) continue

    const props: ViewfieldPhotoProps = {
      providerId: photo.providerId,
      photoId: photo.photoId,
      sequenceId: photo.sequenceId,
      capturedAt: photo.capturedAt,
      isPano: photo.isPano,
      heading: photo.heading,
    }

    if (isPano) {
      features.push({
        type: 'Feature',
        properties: props,
        geometry: panoDisk(photo.lngLat, radius),
      })
      continue
    }

    const triangle = flatViewfieldTriangle(
      photo.lngLat,
      photo.heading!,
      FLAT_VIEWFIELD_FOV_DEG,
      radius,
    )
    features.push({ ...triangle, properties: props })
  }

  return { type: 'FeatureCollection', features }
}

export const emptyPolygonCollection = (): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: [],
})
