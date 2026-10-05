import { describe, expect, it } from 'bun:test'
import { destinationPoint, type LngLat } from '../viewpoints/geometry'
import { ageBand, ageBandColorExpression, ageBandStarts } from './ageBands'
import {
  countByGroup,
  JUNCTION_FEATURE_GROUPS,
  mapFeatureGroupIds,
  SIGN_GROUP_IDS,
  SIGN_GROUPS,
  signGroupFilter,
  signGroupIds,
  signName,
} from './featureGroups'
import { formatRelativeAge } from './imageInfo'
import { bboxAround } from './mapFeatures'
import {
  mapillaryImagesOfTags,
  parseMapillaryTagKey,
  preferredMapillaryImageId,
} from './osmTagKeys'
import {
  bestTargetImage,
  cameraPitch,
  panoX,
  PLACE_TARGET,
  targetImagesByDay,
  viewFromFlatCamera,
  viewFromLocation,
  viewFromOutline,
  type TargetImage,
} from './targetView'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 8, 30)
const CUTOFF = Date.UTC(2024, 0, 1)
const origin: LngLat = [13.4, 52.5]

describe('ageBands', () => {
  it('splits cutoff…now into thirds, older and undated are outdated', () => {
    const { mid, new: newest } = ageBandStarts(CUTOFF, NOW)
    expect(ageBand(CUTOFF - DAY, CUTOFF, NOW)).toBe('outdated')
    expect(ageBand(null, CUTOFF, NOW)).toBe('outdated')
    expect(ageBand(CUTOFF + DAY, CUTOFF, NOW)).toBe('old')
    expect(ageBand(mid + DAY, CUTOFF, NOW)).toBe('mid')
    expect(ageBand(newest + DAY, CUTOFF, NOW)).toBe('new')
  })

  it('builds a step expression on capturedAt', () => {
    const expression = ageBandColorExpression(CUTOFF, NOW)
    expect(expression[0]).toBe('step')
    expect(expression).toHaveLength(9)
    expect(expression[3]).toBe(CUTOFF)
  })
})

describe('featureGroups', () => {
  it('groups signs by name and objects by value', () => {
    expect(signName('regulatory--maximum-speed-limit-30--g1')).toBe('maximum-speed-limit-30')
    expect(signGroupIds('regulatory--maximum-speed-limit-30--g1')).toEqual(['speed'])
    expect(signGroupIds('regulatory--bicycles-only--g1')).toEqual(['bike'])
    expect(signGroupIds('regulatory--no-parking--g2')).toEqual(['parking'])
    expect(signGroupIds('information--parking--g1')).toEqual(['parking'])
    expect(signGroupIds('regulatory--no-stopping--g2')).toEqual(['parking'])
    expect(signGroupIds('regulatory--bicycle-parking--g1')).toEqual(['bike'])
    expect(signGroupIds('information--bike-parking--g1')).toEqual(['bike'])
    expect(signGroupIds('regulatory--no-parking-or-no-stopping--g1')).toEqual(['parking'])
    expect(signGroupIds('warning--curve-left--g1')).toEqual(['other'])
    expect(signGroupIds('object--bench')).toEqual([])
    expect(
      mapFeatureGroupIds('object--traffic-light--pedestrians-front', JUNCTION_FEATURE_GROUPS),
    ).toEqual(['traffic-light'])
  })

  it('lists the sign group ids', () => {
    expect(SIGN_GROUP_IDS).toEqual([...SIGN_GROUPS.map((group) => group.id), 'other'])
  })

  it('filters signs by group and lets objects pass', () => {
    expect(signGroupFilter(SIGN_GROUP_IDS)).toBeUndefined()
    const filter = signGroupFilter(['parking', 'bike'])
    expect(filter?.('regulatory--no-parking--g2')).toBe(true)
    expect(filter?.('regulatory--bicycles-only--g1')).toBe(true)
    expect(filter?.('regulatory--maximum-speed-limit-30--g1')).toBe(false)
    expect(filter?.('warning--curve-left--g1')).toBe(false)
    expect(filter?.('object--bench')).toBe(true)
    expect(signGroupFilter(['bike', 'parking'])).toBe(filter)
  })

  it('counts features per group', () => {
    const counts = countByGroup(
      [
        { value: 'object--traffic-light--general-upright' },
        { value: 'object--traffic-light--cyclists-front' },
        { value: 'marking--discrete--stop-line' },
        { value: 'object--bench' },
      ],
      JUNCTION_FEATURE_GROUPS,
    )
    expect(counts['traffic-light']).toBe(2)
    expect(counts['stop-line']).toBe(1)
    expect(counts.arrow).toBe(0)
  })
})

describe('osmTagKeys', () => {
  it('parses the key grammar and rejects non-image keys', () => {
    expect(parseMapillaryTagKey('source:cycleway:right:traffic_sign:mapillary')).toMatchObject({
      source: true,
      prefix: 'cycleway',
      side: 'right',
      trafficSign: true,
    })
    expect(parseMapillaryTagKey('mapillary:2')?.number).toBe(2)
    expect(parseMapillaryTagKey('mapillary:map_feature')).toBeUndefined()
    expect(parseMapillaryTagKey('was:mapillary')).toBeUndefined()
  })

  it('lists images in display order without duplicates and prefers forward', () => {
    const tags = {
      highway: 'residential',
      'source:traffic_sign:mapillary': '3',
      mapillary: '1;2',
      'mapillary:forward': '9',
      'cycleway:right:mapillary': '2',
    }
    expect(mapillaryImagesOfTags(tags).map((image) => image.imageId)).toEqual(['9', '1', '2', '3'])
    expect(mapillaryImagesOfTags(tags)[3]?.label).toBe('Traffic sign (source)')
    expect(preferredMapillaryImageId(tags)).toBe('9')
  })
})

describe('targetView', () => {
  const image = (id: string, meters: number, day: number, outline = false): TargetImage => ({
    id,
    lngLat: destinationPoint(origin, 180, meters),
    capturedAt: NOW - day * DAY,
    isPano: true,
    outline: outline
      ? [
          [0.4, 0.4],
          [0.5, 0.5],
        ]
      : undefined,
  })

  it('groups by day, newest first; outlined images first, then the good distance', () => {
    const images = [
      image('far', 40, 1),
      image('good', 10, 1),
      image('below', 1, 1),
      image('old', 10, 30, true),
    ]
    const days = targetImagesByDay(images, origin)
    expect(days.map((day) => day.best.id)).toEqual(['good', 'old'])
    expect(bestTargetImage(images, origin)?.id).toBe('good')
    expect(bestTargetImage(images, origin, { minCapturedAt: NOW + DAY })?.id).toBe('good')
  })

  it('centers on an outline and zooms in on small ones', () => {
    const view = viewFromOutline(
      [
        [0.5, 0.5],
        [0.52, 0.52],
      ],
      true,
    )
    expect(view?.center[0]).toBeCloseTo(0.51)
    expect(view?.zoom).toBeGreaterThan(1)
  })

  it('pano: bearing to x, and a wide place target stays zoomed out', () => {
    expect(panoX(90, 90)).toBe(0.5)
    expect(panoX(270, 90)).toBeCloseTo(0)
    const view = viewFromLocation(0.5, image('a', 20, 0), origin, PLACE_TARGET)
    expect(view.zoom).toBeLessThanOrEqual(PLACE_TARGET.maxZoom)
    expect(view.center[1]).toBeGreaterThan(0.5)
  })

  it('flat camera: target ahead is centered, target behind is outside', () => {
    const camera = { focal: 0.8, width: 4000, height: 3000, compassAngle: 0, pitch: 0 }
    const south = destinationPoint(origin, 180, 15)
    expect(viewFromFlatCamera(camera, south, origin)?.center[0]).toBeCloseTo(0.5, 1)
    expect(viewFromFlatCamera({ ...camera, compassAngle: 180 }, south, origin)).toBeUndefined()
  })

  it('camera pitch of a level camera is ~0', () => {
    // Rotation by 90° around x: the camera looks along the horizon.
    expect(Math.abs(cameraPitch([Math.PI / 2, 0, 0]))).toBeLessThan(1)
  })
})

describe('helpers', () => {
  it('formatRelativeAge', () => {
    expect(formatRelativeAge(NOW - 90 * DAY, NOW, 'en')).toBe('3 months ago')
  })

  it('bboxAround is a small box around the point', () => {
    const [west, south, east, north] = bboxAround(origin, 40)
    expect(west).toBeLessThan(origin[0])
    expect(east - west).toBeLessThan(0.01)
    expect(north - south).toBeCloseTo(80 / 111_320, 5)
  })
})

describe('icons', () => {
  it('signs and objects come from different folders', async () => {
    const { mapillaryIconUrl } = await import('./icons')
    expect(mapillaryIconUrl('regulatory--bicycles-only--g1')).toEndWith(
      '/package_signs/regulatory--bicycles-only--g1.svg',
    )
    expect(mapillaryIconUrl('object--traffic-light--cyclists', '/icons/')).toBe(
      '/icons/package_objects/object--traffic-light--cyclists.svg',
    )
  })
})
