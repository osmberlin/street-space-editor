import { SIGN_GROUP_IDS, type SignGroupId } from '@osm-editor-kit/street-imagery'
import { z } from 'zod'

export const EDITOR_PHOTO_PROVIDERS = ['mapillary', 'panoramax'] as const
export type EditorPhotoProvider = (typeof EDITOR_PHOTO_PROVIDERS)[number]

/** Map layer of Mapillary's detected traffic signs (no photos of its own). */
export const EDITOR_SIGNS_LAYER = 'mapillary-signs'

/** Everything the camera menu can switch on: the photo providers and the signs layer. */
export const EDITOR_IMAGERY_LAYERS = [...EDITOR_PHOTO_PROVIDERS, EDITOR_SIGNS_LAYER] as const
export type EditorImageryLayer = (typeof EDITOR_IMAGERY_LAYERS)[number]

export { SIGN_GROUP_IDS, type SignGroupId }

/** Signs this editor is about: parking restrictions and bike signs. The rest is opt-in. */
export const DEFAULT_SIGN_GROUPS: SignGroupId[] = ['parking', 'bike']

export const DEFAULT_PHOTO_TYPES = ['flat', 'pano'] as const
export type EditorPhotoType = (typeof DEFAULT_PHOTO_TYPES)[number]

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    if (year === undefined || month === undefined || day === undefined) return false
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  }, 'Invalid calendar date')

export const editorPhotoProviderSchema = z.enum(EDITOR_PHOTO_PROVIDERS)
export const editorImageryLayerSchema = z.enum(EDITOR_IMAGERY_LAYERS)
export const signGroupSchema = z.enum(SIGN_GROUP_IDS)
export const editorPhotoTypeSchema = z.enum(DEFAULT_PHOTO_TYPES)

export type PhotoSearchSelection = {
  provider: EditorPhotoProvider
  photoId: string
  sequenceId?: string
}

export type PhotoDateSearch = {
  from?: string
  to?: string
  /** Explicit “all ages” from the freshness slider (`photoDate=all` in the URL). */
  all?: boolean
}

export function isEditorPhotoProvider(value: string): value is EditorPhotoProvider {
  return (EDITOR_PHOTO_PROVIDERS as readonly string[]).includes(value)
}

export function parseCommaList(raw: unknown): string[] | undefined {
  if (raw == null || raw === '') return undefined
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    return parts.length > 0 ? parts : undefined
  }
  return undefined
}

export function parsePhotoParam(raw: unknown): PhotoSearchSelection | undefined {
  // The router writes the parsed object back to the URL (`photo={"provider":…}`).
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const { provider, photoId, sequenceId } = raw as Record<string, unknown>
    if (typeof provider !== 'string' || !isEditorPhotoProvider(provider)) return undefined
    if (typeof photoId !== 'string' && typeof photoId !== 'number') return undefined
    return {
      provider,
      photoId: String(photoId),
      ...(sequenceId ? { sequenceId: String(sequenceId) } : {}),
    }
  }
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const parts = raw.split('/')
  if (parts.length < 2) return undefined
  const provider = parts[0]
  const photoId = parts[1]
  if (!provider || !photoId || !isEditorPhotoProvider(provider)) return undefined
  const sequenceId = parts[2]
  return {
    provider,
    photoId,
    ...(sequenceId ? { sequenceId } : {}),
  }
}

export function serializePhotoParam(photo: PhotoSearchSelection | undefined): string | undefined {
  if (!photo) return undefined
  if (photo.sequenceId) return `${photo.provider}/${photo.photoId}/${photo.sequenceId}`
  return `${photo.provider}/${photo.photoId}`
}

export function parsePhotoDateParam(raw: unknown): PhotoDateSearch | undefined {
  if (raw == null || raw === '') return undefined

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const parsed = z
      .object({
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
        all: z.boolean().optional(),
      })
      .safeParse(raw)
    if (!parsed.success) return undefined
    if (parsed.data.all) return { all: true }
    return parsed.data.from || parsed.data.to
      ? { from: parsed.data.from, to: parsed.data.to }
      : undefined
  }

  if (typeof raw !== 'string') return undefined

  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed === 'all') return { all: true }

  const [fromRaw, toRaw] = trimmed.split('/')
  const next: PhotoDateSearch = {}

  if (fromRaw) {
    const from = isoDateSchema.safeParse(fromRaw)
    if (!from.success) return undefined
    next.from = from.data
  }

  if (toRaw) {
    const to = isoDateSchema.safeParse(toRaw)
    if (!to.success) return undefined
    next.to = to.data
  }

  return next.from || next.to ? next : undefined
}

export function serializePhotoDateParam(date: PhotoDateSearch | undefined): string | undefined {
  if (!date) return undefined
  if (date.all) return 'all'
  if (!date.from && !date.to) return undefined
  return `${date.from ?? ''}/${date.to ?? ''}`
}

export function isDefaultPhotoTypes(photoTypes: EditorPhotoType[] | undefined): boolean {
  // Absent from URL / search object means both flat+pano (default).
  if (!photoTypes || photoTypes.length === 0) return true
  if (photoTypes.length !== DEFAULT_PHOTO_TYPES.length) return false
  return DEFAULT_PHOTO_TYPES.every((type) => photoTypes.includes(type))
}

export const streetImageryUsedLabel: Record<EditorPhotoProvider, string> = {
  mapillary: 'Mapillary',
  panoramax: 'Panoramax',
}

export function isDefaultSignGroups(groups: SignGroupId[] | undefined): boolean {
  // Absent from URL / search object means the default groups.
  if (!groups || groups.length === 0) return true
  return (
    groups.length === DEFAULT_SIGN_GROUPS.length &&
    DEFAULT_SIGN_GROUPS.every((id) => groups.includes(id))
  )
}
