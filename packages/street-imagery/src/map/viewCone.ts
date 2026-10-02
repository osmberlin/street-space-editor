import type { Feature, Polygon } from 'geojson'

const ARC_SEGMENTS = 24
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

/** View cone radius in meters; ~50 m at z14, scales with zoom like click search radius. */
export const coneRadiusMeters = (zoom: number): number => 50 * 2 ** (14 - zoom)

/** From this zoom on, view-direction shapes keep their size on screen. */
export const VIEW_SHAPE_FULL_SIZE_ZOOM = 18

/**
 * Radius of the view-direction shapes of photos (360° disks, wedges, the shown photo's cone).
 * Zoomed in they keep their size on screen; below `VIEW_SHAPE_FULL_SIZE_ZOOM` they keep their
 * size on the ground (about 3 m), so they shrink on screen instead of covering the map.
 */
export const viewShapeRadiusMeters = (zoom: number): number =>
  coneRadiusMeters(Math.max(zoom, VIEW_SHAPE_FULL_SIZE_ZOOM))

export const viewConeGeoJson = (
  lngLat: [number, number],
  bearingDeg: number,
  fovDeg: number,
  radiusMeters: number,
): Feature<Polygon> => {
  const [lng, lat] = lngLat
  const centerBearing = normalizeBearing(bearingDeg)
  const halfFov = Math.max(fovDeg, 0) / 2
  const startBearing = centerBearing - halfFov
  const coordinates: [number, number][] = [[lng, lat]]

  for (let index = 0; index <= ARC_SEGMENTS; index += 1) {
    const segmentBearing = startBearing + (index / ARC_SEGMENTS) * fovDeg
    coordinates.push(offsetMeters(lng, lat, segmentBearing, radiusMeters))
  }

  coordinates.push([lng, lat])

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  }
}
