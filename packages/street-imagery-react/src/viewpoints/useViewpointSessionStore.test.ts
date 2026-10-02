import { describe, expect, it } from 'bun:test'
import type { NormalizedPhoto } from '@osm-editor-kit/street-imagery'
import { getViewpointSession } from './useViewpointSessionStore'

const photo = (photoId: string): NormalizedPhoto => ({
  providerId: 'mapillary',
  photoId,
  sequenceId: null,
  capturedAt: null,
  isPano: false,
  heading: 0,
  lngLat: [0, 0],
})

describe('viewpoint session history', () => {
  it('steps back and forward, truncates forward history on a new photo, ignores repeats', () => {
    const { showPhoto, back, forward } = getViewpointSession().actions
    showPhoto({ photo: photo('a'), directionKey: 'here:N' })
    showPhoto({ photo: photo('b'), directionKey: null })
    showPhoto({ photo: photo('b'), directionKey: null })
    expect(back()?.photo.photoId).toBe('a')
    expect(forward()?.photo.photoId).toBe('b')
    expect(forward()).toBeNull()
    expect(getViewpointSession().current?.photo.photoId).toBe('b')
    back()
    showPhoto({ photo: photo('c'), directionKey: 'here:E' })
    expect(forward()).toBeNull()
    expect(back()?.photo.photoId).toBe('a')
  })

  it('gives the shown photo a new direction without a new history step', () => {
    const { showPhoto, reset, back } = getViewpointSession().actions
    reset()
    showPhoto({ photo: photo('first'), directionKey: null })
    showPhoto({ photo: photo('pano'), directionKey: 'start:forward' })
    showPhoto({ photo: photo('pano'), directionKey: 'start:back' })
    expect(getViewpointSession().current?.directionKey).toBe('start:back')
    // One step back is the first photo: the direction change added no step.
    expect(back()?.photo.photoId).toBe('first')
  })
})
