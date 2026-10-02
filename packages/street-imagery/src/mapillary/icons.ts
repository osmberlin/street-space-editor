import { isSignValue } from './featureGroups'

/**
 * Icons for Mapillary values from `@rapideditor/mapillary_sprite_source` (MIT; the set iD and
 * Rapid use): one SVG per value, ~1,500 signs and ~40 objects. Not every value has an icon, so
 * hide the image on load errors.
 */
export const MAPILLARY_ICON_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@rapideditor/mapillary_sprite_source@1.8.0'

/**
 * URL of the icon for a Mapillary value (`regulatory--bicycles-only--g1`,
 * `object--traffic-light--general-upright`). Pass `baseUrl` to serve the package yourself, e.g.
 * copied into your app's public folder, instead of loading from the CDN.
 */
export const mapillaryIconUrl = (value: string, baseUrl = MAPILLARY_ICON_BASE_URL): string =>
  `${baseUrl.replace(/\/$/, '')}/${isSignValue(value) ? 'package_signs' : 'package_objects'}/${encodeURIComponent(value)}.svg`
