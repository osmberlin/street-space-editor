import { describe, expect, it } from 'bun:test'
import type { Feature } from 'geojson'
import { providerById } from '../meta'
import {
  normalizeMapilioPointFeature,
  normalizeMapilioRoadFeature,
  parseMapilioCaptureTime,
  parseMapilioResolution,
} from './mapilio'

describe('mapilio provider', () => {
  it('is disabled in the browser until Mapilio fixes tile-server CORS', () => {
    expect(providerById.mapilio.defaultEnabled).toBe(false)
    expect(providerById.mapilio.browserUnavailableReason).toContain('CORS')
  })
})

describe('parseMapilioCaptureTime', () => {
  it('parses Mapilio capture_time strings', () => {
    expect(parseMapilioCaptureTime('2023-05-01 17:50:18.0')).toBe(
      Date.parse('2023-05-01 17:50:18.0'),
    )
  })

  it('returns null for invalid values', () => {
    expect(parseMapilioCaptureTime('not-a-date')).toBeNull()
    expect(parseMapilioCaptureTime(null)).toBeNull()
  })
})

describe('parseMapilioResolution', () => {
  it('detects panoramic aspect ratios', () => {
    expect(parseMapilioResolution('1920x1920')).toBe(true)
    expect(parseMapilioResolution('3840x1920')).toBe(true)
  })

  it('detects non-panoramic aspect ratios', () => {
    expect(parseMapilioResolution('4624x2600')).toBe(false)
    expect(parseMapilioResolution('1920x1080')).toBe(false)
  })

  it('returns null for missing or invalid resolution', () => {
    expect(parseMapilioResolution(undefined)).toBeNull()
    expect(parseMapilioResolution('invalid')).toBeNull()
  })
})

describe('normalizeMapilioPointFeature', () => {
  it('maps MVT map_points properties to normalized photos', () => {
    const feature: Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [28.96072268486023, 41.0030467821463] },
      properties: {
        id: 830648,
        sequence_uuid: '632ded21-e37d-41c0-931f-3579730ac7b6',
        capture_time: '2023-05-01 17:50:18.0',
        heading: 105.92127227783,
        resolution: '4624x2600',
      },
    }

    expect(normalizeMapilioPointFeature(feature)).toEqual({
      photoId: '830648',
      sequenceId: '632ded21-e37d-41c0-931f-3579730ac7b6',
      capturedAt: Date.parse('2023-05-01 17:50:18.0'),
      isPano: false,
      heading: 105.92127227783,
      lngLat: [28.96072268486023, 41.0030467821463],
    })
  })

  it('returns null for non-point geometries', () => {
    const feature: Feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [28.96, 41.0],
          [28.97, 41.01],
        ],
      },
      properties: { id: 1 },
    }

    expect(normalizeMapilioPointFeature(feature)).toBeNull()
  })
})

describe('normalizeMapilioRoadFeature', () => {
  it('maps MVT map_roads_line properties to normalized sequences', () => {
    const feature: Feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [28.96, 41.0],
          [28.97, 41.01],
        ],
      },
      properties: {
        sequence_uuid: '201dab82-576b-44dd-a77b-2852eb2809df',
        capture_time: '2023-04-24 08:42:45',
      },
    }

    expect(normalizeMapilioRoadFeature(feature)).toEqual({
      sequenceId: '201dab82-576b-44dd-a77b-2852eb2809df',
      geometry: feature.geometry,
      capturedAt: Date.parse('2023-04-24 08:42:45'),
      isPano: null,
    })
  })
})
