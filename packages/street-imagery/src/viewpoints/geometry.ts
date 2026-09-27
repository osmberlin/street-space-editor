import { haversineDistanceMeters } from '../viewer/clickRadius'

export type LngLat = [lng: number, lat: number]

const EARTH_RADIUS_M = 6_371_008.8
const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Normalize to [0, 360). */
export const normalizeBearing = (bearing: number): number => ((bearing % 360) + 360) % 360

/** Smallest absolute difference between two bearings, in [0, 180]. */
export const angleDiffDeg = (a: number, b: number): number => {
  const diff = Math.abs(normalizeBearing(a) - normalizeBearing(b))
  return diff > 180 ? 360 - diff : diff
}

export const distanceMeters = (a: LngLat, b: LngLat): number =>
  haversineDistanceMeters(a[0], a[1], b[0], b[1])

/** Initial compass bearing from `from` to `to` (0 = north, clockwise). */
export const bearingDeg = (from: LngLat, to: LngLat): number => {
  const [lng1, lat1] = [toRad(from[0]), toRad(from[1])]
  const [lng2, lat2] = [toRad(to[0]), toRad(to[1])]
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
  return normalizeBearing(toDeg(Math.atan2(y, x)))
}

export const destinationPoint = (from: LngLat, bearing: number, meters: number): LngLat => {
  const angular = meters / EARTH_RADIUS_M
  const theta = toRad(bearing)
  const lat1 = toRad(from[1])
  const lng1 = toRad(from[0])
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(theta),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  return [toDeg(lng2), toDeg(lat2)]
}

export const lineLengthMeters = (line: LngLat[]): number => {
  let total = 0
  for (let index = 1; index < line.length; index += 1) {
    total += distanceMeters(line[index - 1] as LngLat, line[index] as LngLat)
  }
  return total
}

export type PointOnLine = {
  point: LngLat
  /** Index of the segment start vertex. */
  segmentIndex: number
  /** Bearing of that segment in line direction. */
  bearing: number
}

/** Point `meters` along the line from its start (clamped to the line). */
export const pointAlongLine = (line: LngLat[], meters: number): PointOnLine | null => {
  if (line.length < 2) {
    return null
  }
  let remaining = Math.max(0, meters)
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1] as LngLat
    const end = line[index] as LngLat
    const segmentLength = distanceMeters(start, end)
    const bearing = bearingDeg(start, end)
    if (remaining <= segmentLength || index === line.length - 1) {
      const clamped = Math.min(remaining, segmentLength)
      return { point: destinationPoint(start, bearing, clamped), segmentIndex: index - 1, bearing }
    }
    remaining -= segmentLength
  }
  return null
}

/**
 * Closest point on the line to `point`. Uses a local equirectangular projection per segment,
 * which is precise enough at street scale.
 */
export const snapToLine = (line: LngLat[], point: LngLat): PointOnLine | null => {
  if (line.length < 2) {
    return null
  }
  const cosLat = Math.cos(toRad(point[1]))
  let best: PointOnLine | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1] as LngLat
    const end = line[index] as LngLat
    const dx = (end[0] - start[0]) * cosLat
    const dy = end[1] - start[1]
    const lengthSq = dx * dx + dy * dy
    const t =
      lengthSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point[0] - start[0]) * cosLat * dx + (point[1] - start[1]) * dy) / lengthSq,
            ),
          )
    const candidate: LngLat = [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ]
    const distance = distanceMeters(candidate, point)
    if (distance < bestDistance) {
      bestDistance = distance
      best = { point: candidate, segmentIndex: index - 1, bearing: bearingDeg(start, end) }
    }
  }
  return best
}
