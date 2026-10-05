import { describe, expect, test } from 'bun:test'
import { mapSearchSchema } from '../shell/map/search-schema'
import { parsePhotoParam } from '../shell/map/street-imagery-search-params'

describe('parsePhotoParam', () => {
  test('parses the slim string form', () => {
    expect(parsePhotoParam('mapillary/123/seq')).toEqual({
      provider: 'mapillary',
      photoId: '123',
      sequenceId: 'seq',
    })
  })

  test('accepts the object the router writes back to the URL', () => {
    expect(parsePhotoParam({ provider: 'mapillary', photoId: '123' })).toEqual({
      provider: 'mapillary',
      photoId: '123',
    })
    expect(parsePhotoParam({ provider: 'mapillary-signs', photoId: '1' })).toBeUndefined()
  })
})

describe('sign search params', () => {
  test('the numeric feature id from the router stays a string', () => {
    expect(mapSearchSchema.parse({ feature: 1339443334910168 }).feature).toBe('1339443334910168')
  })

  test('sign groups default to parking and bike', () => {
    expect(mapSearchSchema.parse({}).signGroups).toEqual(['parking', 'bike'])
  })

  test('signs layer and groups', () => {
    const search = mapSearchSchema.parse({
      photos: 'mapillary,mapillary-signs',
      signGroups: 'bike',
    })
    expect(search.photos).toEqual(['mapillary', 'mapillary-signs'])
    expect(search.signGroups).toEqual(['bike'])
  })
})
