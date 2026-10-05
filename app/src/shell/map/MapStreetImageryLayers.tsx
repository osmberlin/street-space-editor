import { MAP_FEATURE_COLOR, signGroupFilter } from '@osm-editor-kit/street-imagery'
import {
  SelectedMapFeatureLayer,
  StreetLevelImagerySourcesAndLayers,
  useMapViewportBbox,
  type PhotoFilter,
} from '@osm-editor-kit/street-imagery-react'
import { useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { MAIN_MAP_ID } from './map-ids'
import { useMapViewport } from './map-viewport'
import { PHOTO_AGE_CIRCLE_COLOR } from './photo-age-style'
import { resolvePhotoDateFilter } from './photo-date-slider'
import { getStreetImageryRuntimeConfig } from './street-imagery-config'
import { useSelectedPhotoForMap } from './use-selected-photo-for-map'
import { useSelectedSign } from './use-selected-sign'

export function MapStreetImageryLayers() {
  const { photos = [], photoTypes, photoDate, signGroups } = useSearch({ from: '/$mode' })
  const map = useMapViewport()
  const bbox = useMapViewportBbox(MAIN_MAP_ID, map)
  const { selectedPhoto, selectedSequenceId, viewerPov } = useSelectedPhotoForMap()
  const sign = useSelectedSign()
  const dateFilter = useMemo(
    () => resolvePhotoDateFilter(photoDate, photos.length > 0),
    [photoDate, photos.length],
  )

  if (photos.length === 0) return null

  const filter: PhotoFilter = {
    photoTypes,
    date: dateFilter,
    mapFeatureValue: signGroupFilter(signGroups),
  }

  return (
    <>
      <StreetLevelImagerySourcesAndLayers
        providers={photos}
        bbox={bbox}
        zoom={map.zoom}
        filter={filter}
        options={{
          config: getStreetImageryRuntimeConfig(),
          showSequences: true,
          showViewfields: true,
          showViewCone: true,
          showSelectionHighlight: true,
          selectedPhoto,
          selectedSequenceId,
          viewerPov,
          photoCircleColor: PHOTO_AGE_CIRCLE_COLOR,
          mapFeatureCircleColor: MAP_FEATURE_COLOR,
        }}
      />
      <SelectedMapFeatureLayer
        data={sign.data}
        shownImage={sign.shownImage}
        providers={photos}
        bbox={bbox}
        zoom={map.zoom}
      />
    </>
  )
}
