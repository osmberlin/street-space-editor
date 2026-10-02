import { describe, expect, it } from 'bun:test'
import { providerExternalLink } from '../../viewer/externalLinks'
import { providerById } from '../meta'
import type { NormalizedPhoto } from '../model'
import { adapterById } from '../registry'
import { encodeLookAroundMvs, lookAroundDeepLink } from './lookaround'

describe('encodeLookAroundMvs', () => {
  it('encodes lat/lng/altitude as a base64 protobuf matching Apple share links', () => {
    const mvs = encodeLookAroundMvs(52.518688, 13.402045, 78.5)
    const raw = Uint8Array.from(atob(mvs), (c) => c.charCodeAt(0))
    expect(raw[0]).toBe(0x0a)
    expect(raw[1]).toBe(27)
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    expect(raw[2]).toBe(0x09)
    expect(view.getFloat64(3, true)).toBeCloseTo(52.518688, 6)
    expect(raw[11]).toBe(0x11)
    expect(view.getFloat64(12, true)).toBeCloseTo(13.402045, 6)
    expect(raw[20]).toBe(0x19)
    expect(view.getFloat64(21, true)).toBeCloseTo(78.5, 6)
  })
})

describe('lookAroundDeepLink', () => {
  it('builds a Look Around URL with coordinate and _mvs view state', () => {
    const url = lookAroundDeepLink(40.706974, -74.011281)
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://maps.apple.com/look-around')
    expect(parsed.searchParams.get('coordinate')).toBe('40.706974,-74.011281')
    expect(parsed.searchParams.get('_mvs')).toBe(encodeLookAroundMvs(40.706974, -74.011281))
  })

  it('includes Berlin click coordinates in both coordinate and _mvs', () => {
    const url = lookAroundDeepLink(52.52, 13.405)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('coordinate')).toBe('52.52,13.405')
    expect(parsed.searchParams.get('_mvs')).toBe(encodeLookAroundMvs(52.52, 13.405))
  })
})

describe('lookaround provider', () => {
  it('is click-only: no adapter, off by default', () => {
    expect(providerById.lookaround.kind).toBe('photo')
    expect(providerById.lookaround.clickOnly).toBe(true)
    expect(providerById.lookaround.defaultEnabled).toBe(false)
    expect(adapterById.lookaround).toBeUndefined()
  })
})

describe('providerExternalLink lookaround', () => {
  it('builds a Look Around deep link from photo coordinates', () => {
    const photo: NormalizedPhoto = {
      providerId: 'lookaround',
      photoId: 'click:52.52,13.405',
      sequenceId: null,
      capturedAt: null,
      isPano: true,
      heading: null,
      lngLat: [13.405, 52.52],
    }
    expect(providerExternalLink(photo)).toBe(lookAroundDeepLink(52.52, 13.405))
  })
})
