import type { StreetImageryLocale } from '@osm-editor-kit/street-imagery'

/** Texts of the photo details dialog and of the button that opens it. */
export type PhotoDetailsLabels = {
  open: string
  title: string
  close: string
  sectionCapture: string
  sectionCamera: string
  sectionPosition: string
  sectionSource: string
  creator: string
  contact: string
  capturedAt: string
  uploadedAt: string
  license: string
  type: string
  pano: string
  flat: string
  camera: string
  focalLength: string
  fieldOfView: string
  coordinates: string
  heading: string
  accuracy: string
  provider: string
  instance: string
  photoId: string
  sequence: string
  rankInSequence: string
  file: string
  exif: (count: number) => string
}

export const PHOTO_DETAILS_LABELS: Record<StreetImageryLocale, PhotoDetailsLabels> = {
  en: {
    open: 'Details of this photo',
    title: 'Photo details',
    close: 'Close',
    sectionCapture: 'Capture',
    sectionCamera: 'Camera',
    sectionPosition: 'Position',
    sectionSource: 'Source',
    creator: 'Creator',
    contact: 'Contact',
    capturedAt: 'Captured',
    uploadedAt: 'Uploaded',
    license: 'Licence',
    type: 'Type',
    pano: '360° panorama',
    flat: 'Flat photo',
    camera: 'Camera',
    focalLength: 'Focal length',
    fieldOfView: 'Field of view',
    coordinates: 'Coordinates',
    heading: 'Heading',
    accuracy: 'Accuracy',
    provider: 'Provider',
    instance: 'Instance',
    photoId: 'Photo ID',
    sequence: 'Sequence',
    rankInSequence: 'Position in sequence',
    file: 'File',
    exif: (count) => `EXIF (${count} tags)`,
  },
  de: {
    open: 'Details zu diesem Foto',
    title: 'Fotodetails',
    close: 'Schließen',
    sectionCapture: 'Aufnahme',
    sectionCamera: 'Kamera',
    sectionPosition: 'Position',
    sectionSource: 'Quelle',
    creator: 'Urheber:in',
    contact: 'Kontakt',
    capturedAt: 'Aufgenommen',
    uploadedAt: 'Hochgeladen',
    license: 'Lizenz',
    type: 'Typ',
    pano: '360°-Panorama',
    flat: 'Normales Foto',
    camera: 'Kamera',
    focalLength: 'Brennweite',
    fieldOfView: 'Bildwinkel',
    coordinates: 'Koordinaten',
    heading: 'Blickrichtung',
    accuracy: 'Genauigkeit',
    provider: 'Anbieter',
    instance: 'Instanz',
    photoId: 'Foto-ID',
    sequence: 'Sequenz',
    rankInSequence: 'Position in der Sequenz',
    file: 'Datei',
    exif: (count) => `EXIF (${count} Einträge)`,
  },
}
