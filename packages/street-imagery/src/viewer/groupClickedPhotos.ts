import type { NormalizedPhoto, ProviderId } from '../providers/model'
import { haversineDistanceMeters } from './clickRadius'

export type PhotoSequenceGroup = {
  providerId: ProviderId
  sequenceId: string
  groupKey: string
  photos: NormalizedPhoto[]
  distanceMeters: number
}

export const sequenceGroupKey = (providerId: ProviderId, sequenceId: string) =>
  `${providerId}:${sequenceId}`

export const photoGroupSequenceId = (photo: NormalizedPhoto): string =>
  photo.sequenceId ?? `photo:${photo.photoId}`

export const distanceToPhoto = (photo: NormalizedPhoto, lng: number, lat: number): number =>
  haversineDistanceMeters(lng, lat, photo.lngLat[0], photo.lngLat[1])

export const findNearestPhoto = (
  photos: NormalizedPhoto[],
  lng: number,
  lat: number,
): NormalizedPhoto | null => {
  if (photos.length === 0) {
    return null
  }

  const first = photos[0]
  if (!first) {
    return null
  }

  let nearest = first
  let nearestDistance = distanceToPhoto(first, lng, lat)

  for (let index = 1; index < photos.length; index += 1) {
    const photo = photos[index]
    if (!photo) {
      continue
    }
    const distance = distanceToPhoto(photo, lng, lat)
    if (distance < nearestDistance) {
      nearest = photo
      nearestDistance = distance
    }
  }

  return nearest
}

const compareCapturedAt = (left: NormalizedPhoto, right: NormalizedPhoto) => {
  const leftTime = left.capturedAt ?? Number.POSITIVE_INFINITY
  const rightTime = right.capturedAt ?? Number.POSITIVE_INFINITY
  if (leftTime !== rightTime) {
    return leftTime - rightTime
  }
  return left.photoId.localeCompare(right.photoId)
}

/** Remove photos within minDistanceMeters of an earlier photo in the same sequence. */
export const dedupeNearbyPhotos = (
  photos: NormalizedPhoto[],
  minDistanceMeters = 5,
): NormalizedPhoto[] => {
  const sorted = [...photos].sort(compareCapturedAt)
  const kept: NormalizedPhoto[] = []

  for (const photo of sorted) {
    const tooClose = kept.some(
      (existing) =>
        haversineDistanceMeters(
          existing.lngLat[0],
          existing.lngLat[1],
          photo.lngLat[0],
          photo.lngLat[1],
        ) < minDistanceMeters,
    )
    if (!tooClose) {
      kept.push(photo)
    }
  }

  return kept
}

export const groupClickedPhotos = (
  photos: NormalizedPhoto[],
  lng: number,
  lat: number,
): PhotoSequenceGroup[] => {
  const byGroup = new Map<string, NormalizedPhoto[]>()

  for (const photo of photos) {
    const sequenceId = photoGroupSequenceId(photo)
    const key = sequenceGroupKey(photo.providerId, sequenceId)
    const group = byGroup.get(key) ?? []
    group.push(photo)
    byGroup.set(key, group)
  }

  const groups: PhotoSequenceGroup[] = []

  for (const [groupKey, groupPhotos] of byGroup) {
    const deduped = dedupeNearbyPhotos(groupPhotos)
    const nearest = findNearestPhoto(deduped, lng, lat)
    if (!nearest) {
      continue
    }

    const sequenceId = photoGroupSequenceId(nearest)
    groups.push({
      providerId: nearest.providerId,
      sequenceId,
      groupKey,
      photos: deduped.sort(compareCapturedAt),
      distanceMeters: distanceToPhoto(nearest, lng, lat),
    })
  }

  return groups.sort((left, right) => {
    if (left.distanceMeters !== right.distanceMeters) {
      return left.distanceMeters - right.distanceMeters
    }
    return left.groupKey.localeCompare(right.groupKey)
  })
}

export const findGroupBySelection = (
  groups: PhotoSequenceGroup[],
  providerId: ProviderId,
  sequenceId: string,
): PhotoSequenceGroup | null =>
  groups.find((group) => group.providerId === providerId && group.sequenceId === sequenceId) ?? null

export const STREETSIDE_NEARBY_LIMIT = 15
