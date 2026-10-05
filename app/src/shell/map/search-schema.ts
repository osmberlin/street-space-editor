import {
  parseFeatureParam,
  parseMapParam,
  serializeFeatureParam,
  serializeMapParam,
} from '@osm-editor-kit/osm-map-url'
import { z } from 'zod'
import { DEFAULT_UI_LOCALE, isUiLocale, type UiLocale } from '../../i18n/uiLocale'
import { parseDebugSearch } from '../debug'
import { hasNonDefaultPrimaryFocus, implicitBoundariesEnabled } from './map-focus-state'
import { defaultPhotoFromIso } from './photo-date-slider'
import {
  DEFAULT_PHOTO_TYPES,
  editorImageryLayerSchema,
  signGroupSchema,
  isDefaultSignGroups,
  DEFAULT_SIGN_GROUPS,
  editorPhotoTypeSchema,
  isDefaultPhotoTypes,
  parseCommaList,
  parsePhotoDateParam,
  parsePhotoParam,
  serializePhotoDateParam,
  serializePhotoParam,
  type PhotoDateSearch,
  type PhotoSearchSelection,
} from './street-imagery-search-params'
import {
  DEFAULT_HIGHWAY_INCLUSION_STYLE,
  type HighwayInclusionStyle,
} from './street-space-way-policy'

export type {
  EditorPhotoProvider,
  EditorPhotoType,
  PhotoDateSearch,
  PhotoSearchSelection,
} from './street-imagery-search-params'
export { DEFAULT_PHOTO_TYPES, EDITOR_PHOTO_PROVIDERS } from './street-imagery-search-params'

export const parkingFocusSchema = z.enum(['all', 'noSurface'])
export const widthFocusSchema = z.enum(['all', 'car', 'bicycle'])
export const bicycleFocusSchema = z.enum(['all', 'incomplete'])
export const surfaceFocusSchema = z.enum(['all', 'roads', 'path', 'sidewalks', 'bike'])
export const highwayInclusionStyleSchema = z.enum(['public', 'inclusive'])

export const mapFocusObjectSchema = z.object({
  parking: parkingFocusSchema.optional(),
  width: widthFocusSchema.optional(),
  bicycle: bicycleFocusSchema.optional(),
  surface: surfaceFocusSchema.optional(),
  /** Admin boundaries overlay; implicit default depends on whether other focus keys are set. */
  boundaries: z.boolean().optional(),
})

export const mapFocusSchema = mapFocusObjectSchema.optional()

export type ParkingFocus = z.infer<typeof parkingFocusSchema>
export type WidthFocus = z.infer<typeof widthFocusSchema>
export type BicycleFocus = z.infer<typeof bicycleFocusSchema>
export type SurfaceFocus = z.infer<typeof surfaceFocusSchema>
export type HighwayInclusionStyleParam = z.infer<typeof highwayInclusionStyleSchema>
export type MapFocus = z.infer<typeof mapFocusSchema>
export type MapFocusObject = z.infer<typeof mapFocusObjectSchema>

const FOCUS_PRIMARY_KEYS = ['parking', 'width', 'bicycle', 'surface'] as const

/**
 * Compact focus URL encoding (avoids JSON `"` → `%22` in the address bar).
 * Example: `bicycle:incomplete,boundaries:false`
 * Also accepts legacy JSON objects / JSON strings from older share links.
 */
export function parseFocusParam(raw: unknown): MapFocus | undefined {
  if (raw == null || raw === '') return undefined

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const parsed = mapFocusObjectSchema.safeParse(raw)
    return parsed.success ? parsed.data : undefined
  }

  if (typeof raw !== 'string') return undefined

  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = mapFocusObjectSchema.safeParse(JSON.parse(trimmed))
      return parsed.success ? parsed.data : undefined
    } catch {
      return undefined
    }
  }

  const next: MapFocusObject = {}
  for (const part of trimmed.split(',')) {
    if (!part) continue
    const colon = part.indexOf(':')
    if (colon <= 0) return undefined
    const key = part.slice(0, colon)
    const value = part.slice(colon + 1)

    if (key === 'boundaries') {
      if (value === 'true') next.boundaries = true
      else if (value === 'false') next.boundaries = false
      else return undefined
      continue
    }

    if (key === 'parking') {
      const parsed = parkingFocusSchema.safeParse(value)
      if (!parsed.success) return undefined
      next.parking = parsed.data
      continue
    }
    if (key === 'width') {
      const parsed = widthFocusSchema.safeParse(value)
      if (!parsed.success) return undefined
      next.width = parsed.data
      continue
    }
    if (key === 'bicycle') {
      const parsed = bicycleFocusSchema.safeParse(value)
      if (!parsed.success) return undefined
      next.bicycle = parsed.data
      continue
    }
    if (key === 'surface') {
      const parsed = surfaceFocusSchema.safeParse(value)
      if (!parsed.success) return undefined
      next.surface = parsed.data
      continue
    }

    return undefined
  }

  return Object.keys(next).length > 0 ? next : undefined
}

/** Serialize slim focus as `key:value,…` (no JSON quotes). */
export function serializeFocusParam(focus: MapFocus | undefined): string | undefined {
  const slim = serializeMapFocus(focus)
  if (!slim) return undefined

  const parts: string[] = []
  for (const key of FOCUS_PRIMARY_KEYS) {
    const value = slim[key]
    if (value) parts.push(`${key}:${value}`)
  }
  if (slim.boundaries !== undefined) parts.push(`boundaries:${slim.boundaries}`)
  return parts.length > 0 ? parts.join(',') : undefined
}

/** Shared map search params (mode is the `/$mode` path slug, e.g. `/parking`). */
export const mapSearchSchema = z.object({
  map: z
    .string()
    .optional()
    .transform((s) => (s ? (parseMapParam(s) ?? undefined) : undefined)),
  f: z
    .string()
    .optional()
    .transform((s) => (s ? (parseFeatureParam(s) ?? undefined) : undefined)),
  /** ELI background imagery slug; omitted = default OpenFreeMap Positron. */
  bg: z.string().min(1).optional(),
  debug: z
    .union([
      z.boolean(),
      z.literal(1),
      z.literal(0),
      z.literal('1'),
      z.literal('true'),
      z.literal('0'),
      z.literal('false'),
    ])
    .optional()
    .transform(parseDebugSearch),
  focus: z.preprocess((raw) => parseFocusParam(raw), mapFocusSchema),
  /** Highway inclusion style; omitted = public (skip private/driveway clutter). */
  ways: highwayInclusionStyleSchema.optional(),
  /** UI language (iD-compatible); omitted = English. */
  locale: z
    .string()
    .optional()
    .transform((s): UiLocale | undefined => (isUiLocale(s) ? s : undefined)),
  /** Enabled street-imagery layers (`mapillary`, `panoramax`, `mapillary-signs`); omitted = off. */
  photos: z
    .preprocess(parseCommaList, z.array(editorImageryLayerSchema).optional())
    .catch(undefined),
  /** Photo geometry filter; omitted = flat + pano. */
  photoTypes: z.preprocess(
    parseCommaList,
    z
      .array(editorPhotoTypeSchema)
      .default([...DEFAULT_PHOTO_TYPES])
      .catch([...DEFAULT_PHOTO_TYPES]),
  ),
  /** Traffic sign groups shown by the signs layer; omitted = parking and bike. */
  signGroups: z.preprocess(
    parseCommaList,
    z
      .array(signGroupSchema)
      .default([...DEFAULT_SIGN_GROUPS])
      .catch([...DEFAULT_SIGN_GROUPS]),
  ),
  /**
   * Selected Mapillary map feature (sign) while the viewer shows its photos. The router parses
   * the numeric id to a number (safe below 2^53, like today's ids), so turn it back to a string.
   */
  feature: z.preprocess(
    (raw) => (typeof raw === 'number' ? String(raw) : raw),
    z.string().optional().catch(undefined),
  ),
  /** Capture-date filter (`from/to` ISO dates, slim `from/to` string in URL). */
  photoDate: z
    .preprocess(parsePhotoDateParam, z.custom<PhotoDateSearch>().optional())
    .catch(undefined),
  /** Selected photo while the viewer is open (`provider/photoId[/sequenceId]`). */
  photo: z
    .preprocess(parsePhotoParam, z.custom<PhotoSearchSelection>().optional())
    .catch(undefined),
  // OAuth redirect callback — kept so validateSearch does not strip them before exchange.
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export type MapSearch = z.infer<typeof mapSearchSchema>

function serializeMapFocus(focus: MapFocus | undefined): MapFocus | undefined {
  if (!focus) return undefined

  const next: NonNullable<MapFocus> = {}
  if (focus.parking && focus.parking !== 'all') next.parking = focus.parking
  if (focus.width && focus.width !== 'all') next.width = focus.width
  if (focus.bicycle && focus.bicycle !== 'all') next.bicycle = focus.bicycle
  if (focus.surface && focus.surface !== 'all') next.surface = focus.surface

  if (focus.boundaries !== undefined && focus.boundaries !== implicitBoundariesEnabled(focus)) {
    next.boundaries = focus.boundaries
  }

  if (!hasNonDefaultPrimaryFocus(next) && next.boundaries === undefined) return undefined
  return next
}

export function serializeMapSearch(
  search: MapSearch,
): Record<string, string | boolean | undefined> {
  return {
    map: search.map ? serializeMapParam(search.map) : undefined,
    f: search.f ? serializeFeatureParam(search.f) : undefined,
    bg: search.bg,
    debug: search.debug,
    focus: serializeFocusParam(search.focus),
    ways: search.ways && search.ways !== DEFAULT_HIGHWAY_INCLUSION_STYLE ? search.ways : undefined,
    locale: search.locale && search.locale !== DEFAULT_UI_LOCALE ? search.locale : undefined,
    photos: search.photos && search.photos.length > 0 ? search.photos.join(',') : undefined,
    photoTypes: isDefaultPhotoTypes(search.photoTypes)
      ? undefined
      : (search.photoTypes?.join(',') ?? undefined),
    signGroups: isDefaultSignGroups(search.signGroups)
      ? undefined
      : (search.signGroups?.join(',') ?? undefined),
    feature: search.feature || undefined,
    photoDate: (() => {
      if (!search.photoDate) return undefined
      if (search.photoDate.all) return 'all'
      // Omit the rolling default (3y) so URLs stay clean when the user never touched the slider.
      if (
        search.photoDate.from &&
        !search.photoDate.to &&
        search.photoDate.from === defaultPhotoFromIso()
      ) {
        return undefined
      }
      return serializePhotoDateParam(search.photoDate)
    })(),

    photo: serializePhotoParam(search.photo),
  }
}

export function readHighwayInclusionStyle(
  ways: HighwayInclusionStyleParam | undefined,
): HighwayInclusionStyle {
  return ways ?? DEFAULT_HIGHWAY_INCLUSION_STYLE
}
