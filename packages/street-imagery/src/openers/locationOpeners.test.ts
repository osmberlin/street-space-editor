import { beforeAll, describe, expect, it } from 'bun:test'
import { createStreetImageryConfig, setStreetImageryConfig } from '../config'
import type { NormalizedPhoto } from '../providers/model'
import { destinationPoint, type LngLat } from '../viewpoints/geometry'
import {
  LOCATION_OPENERS,
  locationOpenerById,
  mapillaryLookAtUrl,
  streetViewLookAtUrl,
} from './locationOpeners'

const PROJECT = 'ec2428b7-8e49-4d93-80a0-edfec6da1cf3'
const target: LngLat = [13.38886, 52.51704]

beforeAll(() => {
  setStreetImageryConfig(
    createStreetImageryConfig({ mapillaryToken: 'test-token', infra3d: { projectUid: PROJECT } }),
  )
})

const photo = (partial: Partial<NormalizedPhoto> & { photoId: string }): NormalizedPhoto => ({
  providerId: 'mapillary',
  sequenceId: null,
  capturedAt: Date.parse('2026-05-01'),
  isPano: false,
  heading: 0,
  lngLat: target,
  ...partial,
})

describe('LOCATION_OPENERS', () => {
  it('builds a link for every opener', () => {
    for (const opener of LOCATION_OPENERS) {
      expect(opener.isAvailable()).toBe(true)
      expect(opener.locationUrl({ lngLat: target, zoom: 17 })).toMatch(/^https:\/\//)
    }
  })

  it('opens infra3D looking at the place', () => {
    const url = new URL(locationOpenerById.infra3d.locationUrl({ lngLat: target }))
    expect(JSON.parse(url.searchParams.get('lookAt') ?? '')).toEqual({
      easting: target[0],
      northing: target[1],
      epsg: 4326,
    })
  })

  it('makes infra3D unavailable without a project', () => {
    setStreetImageryConfig(createStreetImageryConfig({ mapillaryToken: 'test-token' }))
    expect(locationOpenerById.infra3d.isAvailable()).toBe(false)
    setStreetImageryConfig(
      createStreetImageryConfig({ mapillaryToken: 'test-token', infra3d: { projectUid: PROJECT } }),
    )
  })
})

describe('mapillaryLookAtUrl', () => {
  // 20 m south of the target: the target is due north (bearing 0).
  const south = destinationPoint(target, 180, 20)

  it('turns a 360° image to the target', () => {
    const url = mapillaryLookAtUrl(
      [photo({ photoId: 'pano', isPano: true, heading: 90, lngLat: south })],
      target,
    )
    const params = new URL(url ?? '').searchParams
    expect(params.get('pKey')).toBe('pano')
    // The image center looks east (90°), so north is a quarter turn to the left.
    expect(Number(params.get('x'))).toBeCloseTo(0.25, 3)
    expect(Number(params.get('y'))).toBeGreaterThan(0.5)
  })

  it('takes a flat image only when it points at the target', () => {
    const away = photo({ photoId: 'away', heading: 180, lngLat: south })
    const towards = photo({ photoId: 'towards', heading: 10, lngLat: south })
    expect(mapillaryLookAtUrl([away], target)).toBeNull()
    expect(mapillaryLookAtUrl([away, towards], target)).toBe(
      'https://www.mapillary.com/app/?pKey=towards&focus=photo',
    )
  })

  it('finds nothing without images', () => {
    expect(mapillaryLookAtUrl([], target)).toBeNull()
  })
})

describe('streetViewLookAtUrl', () => {
  it('opens the panorama turned to the target', () => {
    const west = destinationPoint(target, 270, 15)
    const pano = photo({
      providerId: 'streetview',
      photoId: 'pano-abc',
      isPano: true,
      lngLat: west,
    })
    const params = new URL(streetViewLookAtUrl(pano, target)).searchParams
    expect(params.get('pano')).toBe('pano-abc')
    expect(params.get('viewpoint')).toBe(`${west[1]},${west[0]}`)
    expect(Number(params.get('heading'))).toBeCloseTo(90, 0)
  })
})
