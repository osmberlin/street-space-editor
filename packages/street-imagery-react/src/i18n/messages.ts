import {
  mapillaryValueName,
  type StreetImageryLocale,
  type ViewDirection,
  type ViewpointRole,
} from '@osm-editor-kit/street-imagery'

/**
 * Every text the package's components show. Texts with values are plain functions, so a host app
 * can override single entries from a constant or from its own i18n library.
 */
export type StreetImageryMessages = {
  viewer: {
    regionLabel: string
    loading: string
    backInHistory: string
    forwardInHistory: string
    minimize: string
    close: string
    views: string
    suggestedViews: string
    suggestedViewsHint: string
    noPhoto: (label: string) => string
    noMatchingPhoto: (label: string) => string
  }
  viewpointRole: Record<ViewpointRole, string>
  unknownDate: string
  /** e.g. "Start, looking along the street"; `role` is the viewpoint's label. */
  viewDirection: (role: string, kind: ViewDirection['kind']) => string
  details: {
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
  feature: {
    /** Name of a Mapillary value like `regulatory--turn-right-ahead--g1`. */
    name: (value: string) => string
    /** Line below the name; `first` and `last` are the rendered dates. */
    seen: string
    noPhotos: string
    daysSummary: (photos: number, days: number) => string
    /** Third tooltip line of a day button, below date and age. */
    dayPhotos: (photos: number, canStep: boolean) => string
  }
}

const en: StreetImageryMessages = {
  viewer: {
    regionLabel: 'Photo viewer',
    loading: 'Loading viewer…',
    backInHistory: 'Back in history ([)',
    forwardInHistory: 'Forward in history (])',
    minimize: 'Minimize',
    close: 'Close (Esc)',
    views: 'Views',
    suggestedViews: 'Suggested views',
    suggestedViewsHint: 'Suggested views: where the photo is taken from, and which way it looks',
    noPhoto: (label) => `${label} (no photo)`,
    noMatchingPhoto: (label) => `${label}: no matching photo`,
  },
  unknownDate: 'Unknown date',
  viewpointRole: {
    here: 'Here',
    'line-start': 'Start',
    'line-end': 'End',
    'into-node': 'Junction',
    custom: 'View',
  },
  viewDirection: (role, kind) => {
    switch (kind) {
      case 'forward':
        return `${role}, looking along the street`
      case 'back':
        return `${role}, looking back along the street`
      case 'into':
        return `${role}, looking into the junction`
      default:
        return `${role}, looking ${kind}`
    }
  },
  details: {
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
  feature: {
    name: (value) => mapillaryValueName(value, 'en'),
    seen: 'Seen',
    noPhotos: 'Mapillary lists no photos for this feature.',
    daysSummary: (photos, days) => `${photos} photos on ${days} days`,
    dayPhotos: (photos, canStep) =>
      `${photos} photo${photos === 1 ? '' : 's'}${canStep ? ' — click for the next one' : ''}`,
  },
}

const COMPASS_DE: Record<string, string> = { N: 'Norden', E: 'Osten', S: 'Süden', W: 'Westen' }

const de: StreetImageryMessages = {
  viewer: {
    regionLabel: 'Fotoansicht',
    loading: 'Ansicht wird geladen…',
    backInHistory: 'Zurück im Verlauf ([)',
    forwardInHistory: 'Vor im Verlauf (])',
    minimize: 'Minimieren',
    close: 'Schließen (Esc)',
    views: 'Blicke',
    suggestedViews: 'Vorgeschlagene Blicke',
    suggestedViewsHint:
      'Vorgeschlagene Blicke: von wo das Foto aufgenommen ist und wohin es schaut',
    noPhoto: (label) => `${label} (kein Foto)`,
    noMatchingPhoto: (label) => `${label}: kein passendes Foto`,
  },
  unknownDate: 'Datum unbekannt',
  viewpointRole: {
    here: 'Hier',
    'line-start': 'Anfang',
    'line-end': 'Ende',
    'into-node': 'Knoten',
    custom: 'Blick',
  },
  viewDirection: (role, kind) => {
    switch (kind) {
      case 'forward':
        return `${role}, Blick entlang der Straße`
      case 'back':
        return `${role}, Blick zurück entlang der Straße`
      case 'into':
        return `${role}, Blick in den Knoten`
      default:
        return `${role}, Blick nach ${COMPASS_DE[kind] ?? kind}`
    }
  },
  details: {
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
  feature: {
    name: (value) => mapillaryValueName(value, 'de'),
    seen: 'Gesehen',
    noPhotos: 'Mapillary führt keine Fotos zu diesem Objekt.',
    daysSummary: (photos, days) => `${photos} Fotos an ${days} Tagen`,
    dayPhotos: (photos, canStep) =>
      `${photos} Foto${photos === 1 ? '' : 's'}${canStep ? ' — klicken für das nächste' : ''}`,
  },
}

export const STREET_IMAGERY_MESSAGES: Record<StreetImageryLocale, StreetImageryMessages> = {
  en,
  de,
}
