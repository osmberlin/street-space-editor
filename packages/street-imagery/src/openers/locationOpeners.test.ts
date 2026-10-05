import { beforeAll, describe, expect, it } from 'bun:test'
import { createStreetImageryConfig, setStreetImageryConfig } from '../config'
import type { Bbox, NormalizedPhoto } from '../providers/model'
import { destinationPoint, type LngLat } from '../viewpoints/geometry'
import {
  findLocationOpener,
  getLocationOpeners,
  getLocationOpenersAt,
  mapillaryLookAtUrl,
  streetViewLookAtUrl,
} from './locationOpeners'

const PROJECT = 'ec2428b7-8e49-4d93-80a0-edfec6da1cf3'
const PROJECTS = [
  { uid: PROJECT, label: 'infra3D Berlin', bbox: [13.08, 52.33, 13.77, 52.68] as Bbox },
  { uid: 'second-project', label: 'Hamburg 2024' },
]
const target: LngLat = [13.38886, 52.51704]

beforeAll(() => {
  setStreetImageryConfig(
    createStreetImageryConfig({ mapillaryToken: 'test-token', infra3d: { projects: PROJECTS } }),
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

describe('getLocationOpeners', () => {
  it('builds a link for every opener', () => {
    for (const opener of getLocationOpeners()) {
      expect(opener.isAvailable()).toBe(true)
      expect(opener.locationUrl({ lngLat: target, zoom: 17 })).toMatch(/^https:\/\//)
    }
  })

  it('passes a start date to Mapillary only', () => {
    const place = { lngLat: target, zoom: 17, dateFrom: '2023-10-05' }
    expect(findLocationOpener('mapillary')?.locationUrl(place)).toBe(
      'https://www.mapillary.com/app/?lat=52.51704&lng=13.38886&z=17&focus=map&dateFrom=2023-10-05',
    )
    expect(findLocationOpener('panoramax')?.locationUrl(place)).not.toContain('2023')
  })

  it('throws on a start date that is not a real day', () => {
    const mapillary = findLocationOpener('mapillary')
    for (const dateFrom of ['2023-13-01', '2023-02-30', '05.10.2023', '2023-10-05T00:00:00Z', '']) {
      expect(() => mapillary?.locationUrl({ lngLat: target, dateFrom })).toThrow('YYYY-MM-DD')
    }
  })

  it('has one infra3D opener per project, with the label of the config', () => {
    const openers = getLocationOpeners().filter((opener) => opener.id.startsWith('infra3d:'))
    expect(openers.map((opener) => opener.label)).toEqual(['infra3D Berlin', 'Hamburg 2024'])
    const url = new URL(openers[1]?.locationUrl({ lngLat: target }) ?? '')
    expect(url.searchParams.get('projectUID')).toBe('second-project')
  })

  it('opens infra3D looking at the place', () => {
    const url = new URL(
      findLocationOpener(`infra3d:${PROJECT}`)?.locationUrl({ lngLat: target }) ?? '',
    )
    expect(JSON.parse(url.searchParams.get('lookAt') ?? '')).toEqual({
      easting: target[0],
      northing: target[1],
      epsg: 4326,
    })
  })

  it('offers an opener only where it has imagery', () => {
    const idsAt = (lngLat: LngLat) => getLocationOpenersAt(lngLat).map((opener) => opener.id)
    const oslo: LngLat = [10.75, 59.91]

    expect(idsAt(target)).toContain(`infra3d:${PROJECT}`)
    expect(idsAt(target)).not.toContain('vegbilder')

    expect(idsAt(oslo)).not.toContain(`infra3d:${PROJECT}`)
    expect(idsAt(oslo)).toContain('vegbilder')
    // A project without a bbox covers every place.
    expect(idsAt(oslo)).toContain('infra3d:second-project')
    expect(idsAt(oslo)).toContain('mapillary')
  })

  it('marks only infra3D as needing an account', () => {
    const locked = getLocationOpeners().filter((opener) => opener.requiresAccount)
    expect(locked.map((opener) => opener.id)).toEqual([
      `infra3d:${PROJECT}`,
      'infra3d:second-project',
    ])
  })

  it('has no infra3D opener without a project', () => {
    setStreetImageryConfig(createStreetImageryConfig({ mapillaryToken: 'test-token' }))
    expect(findLocationOpener(`infra3d:${PROJECT}`)).toBeUndefined()
    setStreetImageryConfig(
      createStreetImageryConfig({ mapillaryToken: 'test-token', infra3d: { projects: PROJECTS } }),
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

  it('skips images from before the start date and keeps the date in the link', () => {
    const old = photo({
      photoId: 'old',
      heading: 0,
      lngLat: south,
      capturedAt: Date.parse('2022-06-01'),
    })
    const recent = photo({ photoId: 'recent', heading: 0, lngLat: south })
    expect(mapillaryLookAtUrl([old], target, { dateFrom: '2023-10-05' })).toBeNull()
    expect(mapillaryLookAtUrl([old, recent], target, { dateFrom: '2023-10-05' })).toBe(
      'https://www.mapillary.com/app/?pKey=recent&focus=photo&dateFrom=2023-10-05',
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
