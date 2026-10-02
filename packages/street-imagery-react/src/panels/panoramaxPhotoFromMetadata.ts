import type { NormalizedPhoto, PhotoDetails } from '@osm-editor-kit/street-imagery'
import type { PnxPictureMetadata } from './panoramax-photo-viewer.d'

const toMs = (iso: string | undefined): number | null => {
  const ms = iso ? Date.parse(iso) : Number.NaN
  return Number.isNaN(ms) ? null : ms
}

/**
 * The shown picture as a photo with everything the Panoramax viewer knows about it: creator,
 * licence, local capture time, camera. The viewer's own legend holds the same; hosts show it in
 * their own layout instead.
 */
export const panoramaxPhotoFromMetadata = (metadata: PnxPictureMetadata): NormalizedPhoto => {
  const properties = metadata.properties ?? {}
  // The viewer lists contact first, then the name ("elgaard@agol.dk", "Niels Elgaard Larsen").
  const producers = metadata.caption?.producer ?? []
  const creatorName = producers.find((entry) => !entry.includes('@')) ?? producers.at(-1)
  const creatorContact = producers.find((entry) => entry.includes('@'))
  const camera = properties['pers:interior_orientation']
  const cameraName = [camera?.camera_manufacturer, camera?.camera_model].filter(Boolean).join(' ')
  const crop = metadata.panorama?.cropData
  const isFlat =
    crop?.croppedWidth != null && crop.fullWidth != null && crop.croppedWidth < crop.fullWidth
  const uploadedAt = toMs(properties.created)
  const exifEntries = Object.entries(properties.exif ?? {})
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => [key, String(value)] as const)
  const exif = exifEntries.length > 0 ? Object.fromEntries(exifEntries) : null

  const details: PhotoDetails = {
    ...(creatorContact && creatorContact !== creatorName ? { creatorContact } : {}),
    ...(properties.license ? { license: properties.license } : {}),
    ...(metadata.origLinks?.find((link) => link.rel === 'license')?.href
      ? { licenseUrl: metadata.origLinks.find((link) => link.rel === 'license')?.href }
      : {}),
    ...(properties.datetimetz ? { capturedAtLocal: properties.datetimetz } : {}),
    ...(uploadedAt != null ? { uploadedAt } : {}),
    ...(cameraName ? { camera: cameraName } : {}),
    ...(isFlat && metadata.horizontalFov ? { fieldOfViewDeg: metadata.horizontalFov } : {}),
    ...(properties['quality:horizontal_accuracy'] != null
      ? { positionAccuracyMeters: properties['quality:horizontal_accuracy'] }
      : {}),
    ...(metadata.origInstance?.instance_name
      ? { instance: metadata.origInstance.instance_name }
      : {}),
    ...(camera?.focal_length != null ? { focalLengthMm: camera.focal_length } : {}),
    ...(properties['original_file:name']
      ? { originalFileName: properties['original_file:name'] }
      : {}),
    ...(properties['original_file:size'] != null
      ? { originalFileSizeBytes: properties['original_file:size'] }
      : {}),
    ...(properties['geovisio:rank_in_collection'] != null
      ? { rankInSequence: properties['geovisio:rank_in_collection'] }
      : {}),
    ...(exif ? { exif } : {}),
  }

  return {
    providerId: 'panoramax',
    photoId: metadata.id,
    sequenceId: metadata.sequence?.id ?? null,
    capturedAt: toMs(properties.datetime),
    isPano: !isFlat,
    heading: properties['view:azimuth'] ?? null,
    lngLat: metadata.gps,
    ...(creatorName ? { creatorName } : {}),
    details,
  }
}
