import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  fetchStreetViewMetadata,
  normalizeStreetViewMetadata,
  parseStreetViewDate,
  type StreetViewMetadataResponse,
} from './streetview'

const okFixture: StreetViewMetadataResponse = {
  status: 'OK',
  date: '2021-08',
  pano_id: 'pano-abc123',
  location: { lat: 37.421755, lng: -122.0838 },
}

describe('parseStreetViewDate', () => {
  it('parses YYYY-MM dates as the first day of the month', () => {
    expect(parseStreetViewDate('2021-08')).toBe(Date.parse('2021-08-01'))
  })

  it('returns null for invalid values', () => {
    expect(parseStreetViewDate('')).toBeNull()
    expect(parseStreetViewDate(undefined)).toBeNull()
  })
})

describe('normalizeStreetViewMetadata', () => {
  it('maps OK metadata to a normalized photo', () => {
    expect(normalizeStreetViewMetadata(okFixture, -122.1, 37.4)).toEqual({
      photoId: 'pano-abc123',
      sequenceId: null,
      capturedAt: Date.parse('2021-08-01'),
      isPano: true,
      heading: null,
      lngLat: [-122.0838, 37.421755],
    })
  })

  it('falls back to click coordinates and a coordinate photoId when pano_id is missing', () => {
    expect(normalizeStreetViewMetadata({ status: 'OK' }, 2.3522, 48.8566)).toEqual({
      photoId: '48.8566,2.3522',
      sequenceId: null,
      capturedAt: null,
      isPano: true,
      heading: null,
      lngLat: [2.3522, 48.8566],
    })
  })

  it('returns null for ZERO_RESULTS', () => {
    expect(normalizeStreetViewMetadata({ status: 'ZERO_RESULTS' }, 0, 0)).toBeNull()
  })
})

describe('fetchStreetViewMetadata', () => {
  const env = import.meta.env as Record<string, string | undefined>
  let originalKey: string | undefined
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalKey = env.VITE_GOOGLE_MAPS_API_KEY
    env.VITE_GOOGLE_MAPS_API_KEY = 'test-key'
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    env.VITE_GOOGLE_MAPS_API_KEY = originalKey
    globalThis.fetch = originalFetch
  })

  it('returns null when the API key is missing', async () => {
    delete env.VITE_GOOGLE_MAPS_API_KEY
    await expect(
      fetchStreetViewMetadata(37.4, -122.1, new AbortController().signal),
    ).resolves.toBeNull()
  })

  it('returns a normalized photo for OK metadata', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => okFixture,
      }),
    ) as unknown as typeof fetch

    await expect(
      fetchStreetViewMetadata(37.4, -122.1, new AbortController().signal),
    ).resolves.toEqual({
      providerId: 'streetview',
      photoId: 'pano-abc123',
      sequenceId: null,
      capturedAt: Date.parse('2021-08-01'),
      isPano: true,
      heading: null,
      lngLat: [-122.0838, 37.421755],
    })
  })

  it('returns null for ZERO_RESULTS', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS' }),
      }),
    ) as unknown as typeof fetch

    await expect(fetchStreetViewMetadata(0, 0, new AbortController().signal)).resolves.toBeNull()
  })

  it('throws for REQUEST_DENIED', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ status: 'REQUEST_DENIED' }),
      }),
    ) as unknown as typeof fetch

    await expect(
      fetchStreetViewMetadata(37.4, -122.1, new AbortController().signal),
    ).rejects.toThrow('Google Street View metadata: REQUEST_DENIED')
  })
})
