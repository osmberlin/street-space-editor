/** Hairline selection chrome — matches parking mode centerlines. */
export const selectedWayCenterlinePaint = {
  'line-color': '#000000',
  'line-width': 1,
  'line-opacity': 1,
} as Record<string, unknown>

/** Thin `>` glyphs along the selected centerline (see `buildCenterlineDirectionMarkers`). */
export const selectedWayCenterlineDirectionLayout = {
  'text-field': '>',
  // MapLibre's default font ("Open Sans Regular") is not on OpenFreeMap's glyph server (404).
  'text-font': ['Noto Sans Regular'],
  'text-size': 8,
  'text-rotate': ['get', 'bearing'],
  'text-rotation-alignment': 'map',
  'text-pitch-alignment': 'map',
  'text-allow-overlap': true,
  'text-ignore-placement': true,
} as Record<string, unknown>

export const selectedWayCenterlineDirectionPaint = {
  'text-color': '#000000',
  'text-opacity': 1,
} as Record<string, unknown>
