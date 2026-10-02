import { describe, expect, it } from 'bun:test'
import { normalizeKartaviewItem, parseKartaviewDate, type KartaviewItem } from './kartaview'

const berlinFixture: KartaviewItem = {
  id: '1320765953',
  sequence_id: '3659453',
  sequence_index: '416',
  lat: '52.522682',
  lng: '13.380118',
  shot_date: '2021-06-12 14:32:10.000',
  date_added: '2021-06-12 15:00:00',
  heading: '259.93',
}

const bucharestFixture: KartaviewItem = {
  id: '1744077833',
  sequence_id: '7434921',
  sequence_index: '8',
  lat: '44.425973',
  lng: '26.116057',
  shot_date: '2023-06-16 17:32:10.000',
  date_added: '2023-06-17 10:52:00',
  heading: '259.93',
}

describe('parseKartaviewDate', () => {
  it('parses shot_date timestamps', () => {
    expect(parseKartaviewDate('2023-06-16 17:32:10.000')).toBe(
      Date.parse('2023-06-16 17:32:10.000'),
    )
  })

  it('returns null for invalid values', () => {
    expect(parseKartaviewDate(undefined)).toBeNull()
    expect(parseKartaviewDate('not-a-date')).toBeNull()
  })
})

describe('normalizeKartaviewItem', () => {
  it('maps Berlin API item to normalized photo', () => {
    expect(normalizeKartaviewItem(berlinFixture)).toEqual({
      photoId: '1320765953',
      sequenceId: '3659453',
      sequenceIndex: 416,
      capturedAt: Date.parse('2021-06-12 14:32:10.000'),
      isPano: null,
      heading: 259.93,
      lngLat: [13.380118, 52.522682],
      thumbUrl: undefined,
    })
  })

  it('builds CDN proxy thumbUrl from the storage image path', () => {
    const expectedStorageUrl = 'https://storage5.openstreetcam.org/files/photo/1.jpg'
    const normalized = normalizeKartaviewItem({
      ...berlinFixture,
      name: '/storage5/files/photo/1.jpg',
    })
    expect(normalized?.thumbUrl).toBe(
      `https://cdn.kartaview.org/pr:sharp/${btoa(expectedStorageUrl).replace(/=+$/, '')}`,
    )
    expect(normalized?.fullUrl).toBe(
      `https://cdn.kartaview.org/pr:sharp/${btoa(expectedStorageUrl).replace(/=+$/, '')}`,
    )
  })

  it('prefers lth_name over name for the thumbnail but keeps fullUrl from name', () => {
    const thumbUrl = normalizeKartaviewItem({
      ...berlinFixture,
      name: 'storage5/files/photo/proc/1.jpg',
      lth_name: 'storage5/files/photo/lth/1.jpg',
    })
    expect(thumbUrl?.thumbUrl).toBe(
      `https://cdn.kartaview.org/pr:sharp/${btoa('https://storage5.openstreetcam.org/files/photo/lth/1.jpg').replace(/=+$/, '')}`,
    )
    expect(thumbUrl?.fullUrl).toBe(
      `https://cdn.kartaview.org/pr:sharp/${btoa('https://storage5.openstreetcam.org/files/photo/proc/1.jpg').replace(/=+$/, '')}`,
    )
  })

  it('falls back to date_added when shot_date is missing', () => {
    const item: KartaviewItem = { ...bucharestFixture, shot_date: undefined }
    expect(normalizeKartaviewItem(item)?.capturedAt).toBe(Date.parse('2023-06-17 10:52:00'))
  })

  it('returns null when coordinates are missing', () => {
    expect(normalizeKartaviewItem({ id: '1' })).toBeNull()
  })
})
