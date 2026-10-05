import { describe, expect, test } from 'bun:test'
import {
  isPanoramaxItemSpherical,
  panoramaxItemFocal,
  panoramaxItemNeighbour,
  panoramaxLevelNeedsOriginal,
  panoramaxPhotoFromItem,
  panoramaxTileRect,
  panoramaxTilesOfLevel,
  panoramaxViewerSize,
  type PanoramaxItem,
} from './panoramaxItem'

const item = (
  orientation: NonNullable<PanoramaxItem['properties']>['pers:interior_orientation'],
): PanoramaxItem => ({
  id: 'pic',
  collection: 'seq',
  geometry: { type: 'Point', coordinates: [13.4, 52.5] },
  links: [
    { rel: 'license', href: 'https://spdx.org/licenses/CC-BY-SA-4.0.html' },
    { rel: 'prev', id: 'before' },
    { rel: 'via', instance_name: 'osm-fr' },
  ],
  properties: {
    datetime: '2026-06-30T09:26:53+00:00',
    license: 'CC-BY-SA-4.0',
    'view:azimuth': 269,
    'geovisio:producer': 'someone',
    'pers:interior_orientation': orientation,
  },
})

const flat = item({ field_of_view: 90, sensor_array_dimensions: [4000, 3000] })
const pano = item({ field_of_view: 360, sensor_array_dimensions: [8704, 4352] })

describe('panoramax item', () => {
  test('a field of view of 360 makes a 360° picture', () => {
    expect(isPanoramaxItemSpherical(pano)).toBe(true)
    expect(isPanoramaxItemSpherical(flat)).toBe(false)
    expect(isPanoramaxItemSpherical(item({ field_of_view: null }))).toBe(false)
  })

  test('focal length is relative to the longer side', () => {
    // 90° across the width: focal = half the width.
    expect(panoramaxItemFocal(flat)).toBeCloseTo(0.5)
    const portrait = item({ field_of_view: 90, sensor_array_dimensions: [3000, 4000] })
    expect(panoramaxItemFocal(portrait)).toBeCloseTo(0.375)
  })

  test('neighbours come from the prev and next links', () => {
    expect(panoramaxItemNeighbour(flat, 'prev')).toBe('before')
    expect(panoramaxItemNeighbour(flat, 'next')).toBeNull()
  })

  test('photo with creator, licence and the Panoramax sequence', () => {
    const photo = panoramaxPhotoFromItem(flat)
    expect(photo).toMatchObject({
      providerId: 'panoramax',
      photoId: 'pic',
      sequenceId: 'seq',
      isPano: false,
      heading: 269,
      lngLat: [13.4, 52.5],
      creatorName: 'someone',
    })
    expect(photo.details).toMatchObject({
      license: 'CC-BY-SA-4.0',
      licenseUrl: 'https://spdx.org/licenses/CC-BY-SA-4.0.html',
      instance: 'osm-fr',
      fieldOfViewDeg: 90,
    })
  })
})

describe('panoramax tiles', () => {
  test('the viewer size has a power of two as its longer side', () => {
    expect(panoramaxViewerSize(pano)).toEqual([16384, 8192])
    expect(panoramaxViewerSize(item({ sensor_array_dimensions: [3000, 4000] }))).toEqual([
      3072, 4096,
    ])
  })

  test('only levels sharper than the sd file need the original', () => {
    const size = panoramaxViewerSize(pano)
    expect(panoramaxLevelNeedsOriginal(size, 11)).toBe(false)
    expect(panoramaxLevelNeedsOriginal(size, 12)).toBe(true)
  })

  test('a level has as many tiles of 1024 px as the scaled picture needs', () => {
    const size = panoramaxViewerSize(pano)
    expect(panoramaxTilesOfLevel(size, 11)).toHaveLength(2)
    expect(panoramaxTilesOfLevel(size, 12)).toHaveLength(8)
  })

  test('a tile is cut from the file at the file’s own scale', () => {
    const size = panoramaxViewerSize(pano)
    // Level 12 is 4096 px wide: tile 1/1 starts a quarter in from the left, half way down.
    expect(panoramaxTileRect(size, { x: 1, y: 1, z: 12 }, { width: 8704, height: 4352 })).toEqual({
      x: 2176,
      y: 2176,
      width: 2176,
      height: 2176,
      outWidth: 1024,
      outHeight: 1024,
    })
  })
})
