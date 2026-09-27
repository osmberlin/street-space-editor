import {
  buildViewSuggestions,
  fetchMapillaryImagesNearPoint,
  yearsToMs,
  type NormalizedPhoto,
  type PhotoTypeFilter,
  type ViewSuggestion,
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
  enabled?: boolean
}

export type ViewSuggestionsResult = {
  suggestions: ViewSuggestion[]
  isLoading: boolean
  isError: boolean
}

/** Mapillary photos per viewpoint (radius search), ranked per view direction. */
export const useViewSuggestions = (
  viewpoints: Viewpoint[],
  { maxAgeYears, photoTypes, limit, filterPhoto, enabled = true }: ViewSuggestionsOptions = {},
): ViewSuggestionsResult => {
  // Reference time for age filter and recency score; stable for the lifetime of the component.
  const [now] = useState(() => Date.now())
  const queries = useQueries({
    queries: viewpoints.map((viewpoint) => ({
      queryKey: ['street-imagery', 'mapillary-radius', viewpoint.lngLat[0], viewpoint.lngLat[1]],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchMapillaryImagesNearPoint(viewpoint.lngLat, {}, signal),
      enabled,
      staleTime: 10 * 60 * 1000,
    })),
  })

  const photosByViewpointId = new Map<string, NormalizedPhoto[]>()
  viewpoints.forEach((viewpoint, index) => {
    const photos = queries[index]?.data ?? []
    photosByViewpointId.set(viewpoint.id, filterPhoto ? photos.filter(filterPhoto) : photos)
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
    isError: queries.some((query) => query.isError),
  }
}
