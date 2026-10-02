import { mapillaryValueName, type StreetImageryLocale } from '@osm-editor-kit/street-imagery'

/**
 * Texts of `MapillaryFeatureBar`. Kept out of the package-wide messages, so the German sign names
 * are only bundled by apps that show the feature bar.
 */
export type MapillaryFeatureBarLabels = {
  /** Name of a Mapillary value like `regulatory--turn-right-ahead--g1`. */
  name: (value: string) => string
  /** Line below the name; `first` and `last` are the rendered dates. */
  seen: string
  noPhotos: string
  daysSummary: (photos: number, days: number) => string
  /** Third tooltip line of a day button, below date and age. */
  dayPhotos: (photos: number, canStep: boolean) => string
}

export const MAPILLARY_FEATURE_BAR_LABELS: Record<StreetImageryLocale, MapillaryFeatureBarLabels> =
  {
    en: {
      name: (value) => mapillaryValueName(value, 'en'),
      seen: 'Seen',
      noPhotos: 'Mapillary lists no photos for this feature.',
      daysSummary: (photos, days) => `${photos} photos on ${days} days`,
      dayPhotos: (photos, canStep) =>
        `${photos} photo${photos === 1 ? '' : 's'}${canStep ? ' — click for the next one' : ''}`,
    },
    de: {
      name: (value) => mapillaryValueName(value, 'de'),
      seen: 'Gesehen',
      noPhotos: 'Mapillary führt keine Fotos zu diesem Objekt.',
      daysSummary: (photos, days) => `${photos} Fotos an ${days} Tagen`,
      dayPhotos: (photos, canStep) =>
        `${photos} Foto${photos === 1 ? '' : 's'}${canStep ? ' — klicken für das nächste' : ''}`,
    },
  }
