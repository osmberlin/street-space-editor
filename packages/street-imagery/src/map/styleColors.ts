import type { DataDrivenPropertyValueSpecification } from 'maplibre-gl'

/**
 * Ready-made style colours for `photoCircleColor` / `mapFeatureCircleColor` of the map layers.
 * For colours by age see `ageBandColorExpression` (red to green, relative to a cutoff date).
 */
export const PHOTO_TYPE_COLORS = {
  panorama: '#2563eb',
  flat: '#16a34a',
  unknown: '#9ca3af',
} as const

/** Blue for 360° photos, green for flat ones, grey when unknown. Reads the `isPano` property. */
export const photoTypeColorExpression: DataDrivenPropertyValueSpecification<string> = [
  'case',
  ['==', ['get', 'isPano'], true],
  PHOTO_TYPE_COLORS.panorama,
  ['==', ['get', 'isPano'], false],
  PHOTO_TYPE_COLORS.flat,
  PHOTO_TYPE_COLORS.unknown,
]

/** Purple of detected map features (signs, objects). */
export const MAP_FEATURE_COLOR = '#7c3aed'
