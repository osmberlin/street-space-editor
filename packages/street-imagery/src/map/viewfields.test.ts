import { describe, expect, test } from 'bun:test'
import type { NormalizedPhoto } from '../providers/model'
import {
  FLAT_VIEWFIELD_FOV_DEG,
  flatViewfieldTriangle,
  photosToViewfieldsFeatureCollection,
} from './viewfields'

const photo = (overrides: Partial<NormalizedPhoto> = {}): NormalizedPhoto => ({
  providerId: 'mapillary',
  photoId: '1',
  sequenceId: 's1',
  capturedAt: Date.UTC(2024, 0, 1),
  isPano: false,
  heading: 90,
  lngLat: [13.4, 52.5],
  ...overrides,
})

describe('flatViewfieldTriangle', () => {
  test('builds a closed triangle pointing with bearing', () => {
    const feature = flatViewfieldTriangle([13.4, 52.5], 0, FLAT_VIEWFIELD_FOV_DEG, 50)
    const ring = feature.geometry.coordinates[0]!
    expect(ring).toHaveLength(4)
    expect(ring[0]).toEqual(ring[3])
    // Bearing 0 → north; both rays should be north of apex
    expect(ring[1]![1]).toBeGreaterThan(52.5)
    expect(ring[2]![1]).toBeGreaterThan(52.5)
  })
})

describe('photosToViewfieldsFeatureCollection', () => {
  test('skips flat photos without heading', () => {
    const collection = photosToViewfieldsFeatureCollection(
      [photo({ heading: null, isPano: false })],
      14,
    )
    expect(collection.features).toHaveLength(0)
  })

  test('builds a triangle for flat photos with heading', () => {
    const collection = photosToViewfieldsFeatureCollection([photo()], 14)
    expect(collection.features).toHaveLength(1)
    expect(collection.features[0]!.geometry.coordinates[0]).toHaveLength(4)
    expect(collection.features[0]!.properties.isPano).toBe(false)
  })

  test('builds a full disk for panos even without heading', () => {
    const collection = photosToViewfieldsFeatureCollection(
      [photo({ isPano: true, heading: null, photoId: 'pano' })],
      14,
    )
    expect(collection.features).toHaveLength(1)
    // Full circle uses arc segments + apex close → more than a triangle
    expect(collection.features[0]!.geometry.coordinates[0]!.length).toBeGreaterThan(4)
    expect(collection.features[0]!.properties.isPano).toBe(true)
  })
})

describe('photosToViewfieldsFeatureCollection limits', () => {
  test('keeps only photos inside the bbox', () => {
    const collection = photosToViewfieldsFeatureCollection(
      [photo({ photoId: 'in' }), photo({ photoId: 'out', lngLat: [14, 53] })],
      17,
      { bbox: [13.3, 52.4, 13.5, 52.6] },
    )
    expect(collection.features.map((f) => f.properties.photoId)).toEqual(['in'])
  })

  test('caps the number of viewfields, newest first', () => {
    const collection = photosToViewfieldsFeatureCollection(
      [
        photo({ photoId: 'old', capturedAt: 1 }),
        photo({ photoId: 'new', capturedAt: 3 }),
        photo({ photoId: 'mid', capturedAt: 2 }),
      ],
      17,
      { maxFeatures: 2 },
    )
    expect(collection.features.map((f) => f.properties.photoId)).toEqual(['new', 'mid'])
  })
})
