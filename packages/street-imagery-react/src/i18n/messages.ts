import {
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
    suggestedViews: string
    suggestedViewsHint: string
    noPhoto: (label: string) => string
    noMatchingPhoto: (label: string) => string
    nextPhotoOfView: (label: string) => string
  }
  viewpointRole: Record<ViewpointRole, string>
  /** Eight compass points, clockwise from north: N, NE, E, SE, S, SW, W, NW. */
  compass: readonly string[]
  unknownDate: string
  dateFilter: {
    allDates: string
    /** e.g. "Since 5 Oct 2024". */
    since: (date: string) => string
    until: (date: string) => string
    between: (from: string, to: string) => string
    /** Short label below a year line, e.g. "2 y". */
    yearsShort: (years: number) => string
    /** Tooltip of a year label; a click shows the photos of the last `years` years. */
    lastYears: (years: number) => string
    recommendedMaxAge: (years: number) => string
    fromHandle: string
    toHandle: string
    exactDates: string
    from: string
    to: string
    photoCount: (count: number) => string
  }
  /** e.g. "Start, looking along the street"; `role` is the viewpoint's label. */
  viewDirection: (role: string, kind: ViewDirection['kind']) => string
}

const en: StreetImageryMessages = {
  viewer: {
    regionLabel: 'Photo viewer',
    loading: 'Loading viewer…',
    backInHistory: 'Back in history ([)',
    forwardInHistory: 'Forward in history (])',
    minimize: 'Minimize',
    close: 'Close (Esc)',
    suggestedViews: 'Suggested views',
    suggestedViewsHint: 'Suggested views: where the photo is taken from, and which way it looks',
    noPhoto: (label) => `${label} (no photo)`,
    noMatchingPhoto: (label) => `${label}: no matching photo`,
    nextPhotoOfView: (label) => `${label} — click for the next photo`,
  },
  unknownDate: 'Unknown date',
  dateFilter: {
    allDates: 'All dates',
    since: (date) => `Since ${date}`,
    until: (date) => `Until ${date}`,
    between: (from, to) => `${from} – ${to}`,
    yearsShort: (years) => `${years} y`,
    lastYears: (years) => (years === 1 ? 'Show the last year' : `Show the last ${years} years`),
    recommendedMaxAge: (years) =>
      `Recommended: photos of the last ${years === 1 ? 'year' : `${years} years`}`,
    fromHandle: 'Oldest photos to show',
    toHandle: 'Newest photos to show',
    exactDates: 'Exact dates',
    from: 'From',
    to: 'To',
    photoCount: (count) => (count === 1 ? '1 photo' : `${count.toLocaleString('en')} photos`),
  },
  viewpointRole: {
    here: 'Here',
    'line-start': 'Start',
    'line-end': 'End',
    'into-node': 'Junction',
    custom: 'View',
  },
  compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  viewDirection: (role, kind) => {
    switch (kind) {
      case 'forward':
        return `${role}, looking along the street`
      case 'back':
        return `${role}, looking back along the street`
      case 'right':
        return `${role}, looking right across the street`
      case 'left':
        return `${role}, looking left across the street`
      case 'into':
        return `${role}, looking into the junction`
      default:
        return `${role}, looking ${kind}`
    }
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
    suggestedViews: 'Vorgeschlagene Blicke',
    suggestedViewsHint:
      'Vorgeschlagene Blicke: von wo das Foto aufgenommen ist und wohin es schaut',
    noPhoto: (label) => `${label} (kein Foto)`,
    noMatchingPhoto: (label) => `${label}: kein passendes Foto`,
    nextPhotoOfView: (label) => `${label} — klicken für das nächste Foto`,
  },
  unknownDate: 'Datum unbekannt',
  dateFilter: {
    allDates: 'Alle Daten',
    since: (date) => `Seit ${date}`,
    until: (date) => `Bis ${date}`,
    between: (from, to) => `${from} – ${to}`,
    yearsShort: (years) => `${years} J.`,
    lastYears: (years) =>
      years === 1 ? 'Das letzte Jahr zeigen' : `Die letzten ${years} Jahre zeigen`,
    recommendedMaxAge: (years) =>
      `Empfohlen: Fotos ${years === 1 ? 'des letzten Jahres' : `der letzten ${years} Jahre`}`,
    fromHandle: 'Älteste Fotos, die gezeigt werden',
    toHandle: 'Neueste Fotos, die gezeigt werden',
    exactDates: 'Genaue Daten',
    from: 'Von',
    to: 'Bis',
    photoCount: (count) => (count === 1 ? '1 Foto' : `${count.toLocaleString('de')} Fotos`),
  },
  viewpointRole: {
    here: 'Hier',
    'line-start': 'Anfang',
    'line-end': 'Ende',
    'into-node': 'Knoten',
    custom: 'Blick',
  },
  compass: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  viewDirection: (role, kind) => {
    switch (kind) {
      case 'forward':
        return `${role}, Blick entlang der Straße`
      case 'back':
        return `${role}, Blick zurück entlang der Straße`
      case 'right':
        return `${role}, Blick nach rechts quer zur Straße`
      case 'left':
        return `${role}, Blick nach links quer zur Straße`
      case 'into':
        return `${role}, Blick in den Knoten`
      default:
        return `${role}, Blick nach ${COMPASS_DE[kind] ?? kind}`
    }
  },
}

export const STREET_IMAGERY_MESSAGES: Record<StreetImageryLocale, StreetImageryMessages> = {
  en,
  de,
}
