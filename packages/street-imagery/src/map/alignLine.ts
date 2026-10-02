import type { LngLat } from '../viewpoints/geometry'

const METERS_PER_DEGREE = 111_320

/**
 * Make a line run through the points that lie on it. Sequence lines come simplified from vector
 * tiles, so they pass beside their photos: every point within `reachMeters` of the line becomes a
 * corner of it (at its place along the line), and an old corner right next to a point is dropped.
 * Points farther away are ignored. Uses flat-earth math, which is exact enough at this scale.
 */
export const alignLineToPoints = (
  line: readonly LngLat[],
  points: readonly LngLat[],
  reachMeters = 6,
): LngLat[] => {
  const first = line[0]
  if (line.length < 2 || points.length === 0 || !first) {
    return [...line]
  }
  const mLng = METERS_PER_DEGREE * Math.cos((first[1] * Math.PI) / 180)
  const mLat = METERS_PER_DEGREE
  const xs = line.map((corner) => corner[0] * mLng)
  const ys = line.map((corner) => corner[1] * mLat)
  const minX = Math.min(...xs) - reachMeters
  const maxX = Math.max(...xs) + reachMeters
  const minY = Math.min(...ys) - reachMeters
  const maxY = Math.max(...ys) + reachMeters
  const reachSq = reachMeters * reachMeters
  // An old corner this close to a point is the point's simplified self.
  const dropSq = (reachMeters / 2) * (reachMeters / 2)

  /** Points per segment (segment `i` runs from corner `i` to `i + 1`), with their place on it. */
  const onSegment = new Map<number, { t: number; point: LngLat }[]>()
  const dropped = new Set<number>()

  for (const point of points) {
    const px = point[0] * mLng
    const py = point[1] * mLat
    if (px < minX || px > maxX || py < minY || py > maxY) {
      continue
    }
    let best: { segment: number; t: number; distanceSq: number } | null = null
    for (let segment = 0; segment < line.length - 1; segment += 1) {
      const ax = xs[segment] as number
      const ay = ys[segment] as number
      const dx = (xs[segment + 1] as number) - ax
      const dy = (ys[segment + 1] as number) - ay
      const lengthSq = dx * dx + dy * dy
      const t =
        lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
      const ex = ax + dx * t - px
      const ey = ay + dy * t - py
      const distanceSq = ex * ex + ey * ey
      if (distanceSq <= reachSq && (!best || distanceSq < best.distanceSq)) {
        best = { segment, t, distanceSq }
      }
    }
    if (!best) {
      continue
    }
    const entries = onSegment.get(best.segment) ?? []
    entries.push({ t: best.t, point })
    onSegment.set(best.segment, entries)
    for (const corner of [best.segment, best.segment + 1]) {
      const cx = (xs[corner] as number) - px
      const cy = (ys[corner] as number) - py
      if (cx * cx + cy * cy <= dropSq) {
        dropped.add(corner)
      }
    }
  }

  if (onSegment.size === 0) {
    return [...line]
  }
  const aligned: LngLat[] = []
  line.forEach((corner, index) => {
    if (!dropped.has(index)) {
      aligned.push(corner)
    }
    const entries = onSegment.get(index)
    if (entries) {
      entries.sort((a, b) => a.t - b.t)
      for (const { point } of entries) {
        aligned.push(point)
      }
    }
  })
  return aligned.length >= 2 ? aligned : [...line]
}
