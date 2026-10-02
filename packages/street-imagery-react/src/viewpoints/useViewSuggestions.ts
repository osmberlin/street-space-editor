import {
  buildViewSuggestions,
  mapillaryPhotoSource,
  yearsToMs,
  type NormalizedPhoto,
  type PhotoTypeFilter,
  type ViewSuggestion,
  type ViewpointPhotoSource,
  type Viewpoint,
} from '@osm-editor-kit/street-imagery'
import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'

export type ViewSuggestionsOptions = {
  /** Only photos from the last N years. */
  maxAgeYears?: number
  photoTypes?: PhotoTypeFilter[]
  /** Candidates kept per direction. */
  limit?: number
  /** Extra app filter (e.g. date range), applied before ranking. */
  filterPhoto?: (photo: NormalizedPhoto) => boolean
  /**
   * Where photos come from; default Mapillary. Pass several to rank across providers, e.g.
   * `[mapillaryPhotoSource, streetViewPhotoSource]` or your own (Infra3D).
   */
  sources?: ViewpointPhotoSource[]
  enabled?: boolean
}

export type ViewSuggestionsResult = {
  suggestions: ViewSuggestion[]
  isLoading: boolean
  isError: boolean
}

const DEFAULT_SOURCES = [mapillaryPhotoSource]

/** Photos near each viewpoint from all `sources`, ranked per view direction. */
export const useViewSuggestions = (
  viewpoints: Viewpoint[],
  {
    maxAgeYears,
    photoTypes,
    limit,
    filterPhoto,
    sources = DEFAULT_SOURCES,
    enabled = true,
  }: ViewSuggestionsOptions = {},
): ViewSuggestionsResult => {
  // Reference time for age filter and recency score; stable for the lifetime of the component.
  const [now] = useState(() => Date.now())
  // One query per viewpoint × source, so a slow or failing provider does not block the others.
  const requests = viewpoints.flatMap((viewpoint) =>
    sources.map((source) => ({ viewpoint, source })),
  )
  const queries = useQueries({
    queries: requests.map(({ viewpoint, source }) => ({
      queryKey: [
        'street-imagery',
        'photos-near',
        source.id,
        viewpoint.lngLat[0],
        viewpoint.lngLat[1],
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) => source.fetchNear(viewpoint.lngLat, signal),
      enabled,
      staleTime: 10 * 60 * 1000,
    })),
  })

  const photosByViewpointId = new Map<string, NormalizedPhoto[]>()
  requests.forEach(({ viewpoint }, index) => {
    const photos = queries[index]?.data ?? []
    const kept = filterPhoto ? photos.filter(filterPhoto) : photos
    photosByViewpointId.set(viewpoint.id, [
      ...(photosByViewpointId.get(viewpoint.id) ?? []),
      ...kept,
    ])
  })

  const suggestions = buildViewSuggestions(
    viewpoints,
    (viewpoint) => photosByViewpointId.get(viewpoint.id) ?? [],
    {
      now,
      maxAgeMs: maxAgeYears == null ? undefined : yearsToMs(maxAgeYears),
      photoTypes,
      limit,
    },
  )

  return {
    suggestions,
    isLoading: enabled && queries.some((query) => query.isPending),
    // An error only when every source failed; one failing provider still leaves suggestions.
    isError: queries.length > 0 && queries.every((query) => query.isError),
  }
}
