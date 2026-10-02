import { describe, expect, it } from 'bun:test'
import type { NormalizedPhoto } from '../providers/model'
import {
  angleDiffDeg,
  bearingDeg,
  destinationPoint,
  distanceMeters,
  pointAlongLine,
  snapToLine,
  type LngLat,
} from './geometry'
import { normalizeMapillaryGraphImage } from './mapillaryRadiusSearch'
import { buildViewSuggestions, rankPhotosForDirection, yearsToMs } from './rankPhotos'
import {
  viewDirections,
  viewpointFromPoint,
  viewpointsFromLine,
  viewpointsIntoNode,
  type Viewpoint,
} from './viewpoints'

const origin: LngLat = [13.45, 52.47]
const NOW = Date.UTC(2026, 8, 1)
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

const photo = (
  overrides: Partial<NormalizedPhoto> & Pick<NormalizedPhoto, 'photoId'>,
): NormalizedPhoto => ({
  providerId: 'mapillary',
  sequenceId: 's',
  capturedAt: NOW - MONTH_MS,
  isPano: false,
  heading: 0,
  lngLat: origin,
  ...overrides,
})

/** Point `meters` from origin in `bearing`. */
const at = (bearing: number, meters: number) => destinationPoint(origin, bearing, meters)

describe('geometry', () => {
  it('bearing and destination round-trip', () => {
    const east = at(90, 100)
    expect(bearingDeg(origin, east)).toBeCloseTo(90, 0)
    expect(distanceMeters(origin, east)).toBeCloseTo(100, 0)
  })

  it('angleDiffDeg wraps around north', () => {
    expect(angleDiffDeg(350, 10)).toBe(20)
    expect(angleDiffDeg(0, 180)).toBe(180)
  })

  it('pointAlongLine walks across vertices', () => {
    const line = [origin, at(0, 100), destinationPoint(at(0, 100), 90, 100)]
    const result = pointAlongLine(line, 150)
    expect(result?.segmentIndex).toBe(1)
    expect(result?.bearing).toBeCloseTo(90, 0)
  })

  it('snapToLine returns the closest point and segment bearing', () => {
    const line = [origin, at(90, 200)]
    const snapped = snapToLine(line, destinationPoint(at(90, 50), 0, 20))
    expect(snapped && distanceMeters(snapped.point, at(90, 50))).toBeLessThan(1)
    expect(snapped?.bearing).toBeCloseTo(90, 0)
  })
})

describe('viewpoints', () => {
  it('undirected point viewpoint looks in four compass directions', () => {
    const kinds = viewDirections(viewpointFromPoint(origin)).map((d) => d.kind)
    expect(kinds).toEqual(['N', 'E', 'S', 'W'])
  })

  it('line viewpoints: start, click, end with forward + back', () => {
    const line = [origin, at(90, 300)]
    const viewpoints = viewpointsFromLine(line, destinationPoint(at(90, 150), 0, 5))
    expect(viewpoints.map((v) => v.role)).toEqual(['line-start', 'here', 'line-end'])
    for (const viewpoint of viewpoints) {
      expect(viewpoint.bearing).toBeCloseTo(90, 0)
      const directions = viewDirections(viewpoint)
      expect(directions.map((d) => d.kind)).toEqual(['forward', 'back'])
      expect(directions[1]?.bearing).toBeCloseTo(270, 0)
    }
  })

  it('line click next to an end is merged into that end', () => {
    const line = [origin, at(90, 300)]
    const viewpoints = viewpointsFromLine(line, at(90, 5))
    expect(viewpoints.map((v) => v.role)).toEqual(['line-start', 'line-end'])
  })

  it('into-node viewpoints sit up each street and look into the node', () => {
    const north = [at(0, 60), origin]
    const east = [origin, at(90, 60)]
    const viewpoints = viewpointsIntoNode(origin, [north, east])
    expect(viewpoints).toHaveLength(2)
    expect(distanceMeters(viewpoints[0]!.lngLat, origin)).toBeCloseTo(20, 0)
    expect(viewpoints[0]!.bearing).toBeCloseTo(180, 0)
    expect(viewpoints[1]!.bearing).toBeCloseTo(270, 0)
    expect(viewDirections(viewpoints[0]!).map((d) => d.kind)).toEqual(['into'])
  })
})

describe('rankPhotosForDirection', () => {
  const viewpoint: Viewpoint = { id: 'v', lngLat: origin, bearing: 90, role: 'here' }
  const [forward] = viewDirections(viewpoint)
  const rank = (photos: NormalizedPhoto[], options = {}) =>
    rankPhotosForDirection(photos, viewpoint, forward!, { now: NOW, ...options }).map(
      (c) => c.photo.photoId,
    )

  it('keeps flat photos looking the wanted way, drops others', () => {
    expect(
      rank([
        photo({ photoId: 'east', heading: 85 }),
        photo({ photoId: 'north', heading: 0 }),
        photo({ photoId: 'no-heading', heading: null }),
      ]),
    ).toEqual(['east'])
  })

  it('prefers photos behind the viewpoint over photos past it', () => {
    expect(
      rank([
        photo({ photoId: 'past', heading: 90, lngLat: at(90, 20) }),
        photo({ photoId: 'behind', heading: 90, lngLat: at(270, 20) }),
      ]),
    ).toEqual(['behind'])
  })

  it('prefers a newer flat photo over an older pano, but a pano beats nothing', () => {
    const pano = photo({
      photoId: 'pano',
      isPano: true,
      heading: 300,
      capturedAt: NOW - 6 * MONTH_MS,
    })
    expect(rank([pano, photo({ photoId: 'flat', heading: 95 })])).toEqual(['flat', 'pano'])
    expect(rank([pano])).toEqual(['pano'])
  })

  it('pano-only filter drops flat photos', () => {
    expect(
      rank([photo({ photoId: 'flat', heading: 90 }), photo({ photoId: 'pano', isPano: true })], {
        photoTypes: ['pano'],
      }),
    ).toEqual(['pano'])
  })

  it('max age drops old and undated photos', () => {
    expect(
      rank(
        [
          photo({ photoId: 'new', heading: 90 }),
          photo({ photoId: 'old', heading: 90, capturedAt: NOW - yearsToMs(3) }),
          photo({ photoId: 'undated', heading: 90, capturedAt: null }),
        ],
        { maxAgeMs: yearsToMs(2) },
      ),
    ).toEqual(['new'])
  })

  it('newer wins among equally good photos', () => {
    expect(
      rank([
        photo({ photoId: 'older', heading: 90, capturedAt: NOW - 20 * MONTH_MS }),
        photo({ photoId: 'newer', heading: 90, capturedAt: NOW - MONTH_MS }),
      ]),
    ).toEqual(['newer', 'older'])
  })
})

describe('buildViewSuggestions', () => {
  it('creates one suggestion per viewpoint direction', () => {
    const suggestions = buildViewSuggestions(
      [viewpointFromPoint(origin)],
      () => [photo({ photoId: 'north', heading: 0 })],
      { now: NOW },
    )
    expect(suggestions.map((s) => [s.direction.kind, s.candidates.length])).toEqual([
      ['N', 1],
      ['E', 0],
      ['S', 0],
      ['W', 0],
    ])
  })
})

describe('normalizeMapillaryGraphImage', () => {
  it('prefers computed geometry and heading', () => {
    expect(
      normalizeMapillaryGraphImage({
        id: '1',
        captured_at: 5,
        compass_angle: 10,
        computed_compass_angle: 20,
        is_pano: false,
        geometry: { type: 'Point', coordinates: [1, 2] },
        computed_geometry: { type: 'Point', coordinates: [3, 4] },
        sequence: 'seq',
      }),
    ).toEqual({
      providerId: 'mapillary',
      photoId: '1',
      sequenceId: 'seq',
      capturedAt: 5,
      isPano: false,
      heading: 20,
      lngLat: [3, 4],
      originalLngLat: [1, 2],
    })
  })
})
