# `@osm-editor-kit/street-imagery-react`

> [!NOTE]
> This package is an **alpha** release and still under active development. APIs may change; install with the npm `alpha` dist-tag.

## What it does

React + MapLibre UI on top of `@osm-editor-kit/street-imagery`:

- Map sources and layers for photos, sequences, and viewfields
- Click handling and interactive layer ids
- TanStack Query hooks to load provider data for the viewport
- Lazy Mapillary and Panoramax viewer panels
- Helpers for selection, thumbnails, and easing the map to a photo
- Viewpoints + floating photo viewer: suggested views per direction, history, map layer

## Usage

```tsx
import {
  StreetLevelImagerySourcesAndLayers,
  StreetLevelImageryViewer,
  useMapViewportBbox,
  queryStreetImageryFeatures,
  streetImageryInteractiveLayerIds,
} from '@osm-editor-kit/street-imagery-react'
import { createStreetImageryConfig } from '@osm-editor-kit/street-imagery'

const bbox = useMapViewportBbox('main', map)

<StreetLevelImagerySourcesAndLayers
  providers={['mapillary', 'panoramax']}
  bbox={bbox}
  zoom={map.zoom}
  filter={{ photoTypes: ['flat', 'pano'] }}
  options={{
    config: createStreetImageryConfig({ mapillaryToken: '…' }),
    showSequences: true,
    showViewfields: true,
    selectedPhoto,
    photoCircleColor: '#3b82f6',
    mapFeatureCircleColor: '#94a3b8',
  }}
/>

// interactiveLayerIds={streetImageryInteractiveLayerIds(providers)}
const hits = queryStreetImageryFeatures(event)

<StreetLevelImageryViewer photo={selectedPhoto} groupPhotos={sequencePhotos}
  onPhotoSelected={setSelection} onEaseMapToPoint={(lng, lat) => map.easeTo({ center: [lng, lat] })} />
```

**Mapillary:** `createStreetImageryConfig({ mapillaryToken })` or `setStreetImageryConfig` at boot (`@osm-editor-kit/street-imagery`). **Panoramax + Vite:** see `app/vite.config.ts` for the consuming-app setup.

Also: `useAllProviderPhotos`, `useProviderPhotos` / `useProviderSequences` / `useProviderMapFeatures`, `usePhotoThumbnails`, `resolveSelectedSequence`, `StreetLevelImageryViewCone`, `useViewerBearing` / `useViewerActions`, `MapillaryPanel`, `PanoramaxPanel`.

## Viewpoints and floating viewer

Click → viewpoints → ranked Mapillary photos per view direction → floating viewer with chips and history.

```tsx
import { viewpointFromPoint, viewpointsFromLine } from '@osm-editor-kit/street-imagery'
import {
  FloatingPhotoViewer,
  getViewpointSession,
  useViewpoints,
  useViewSuggestions,
  ViewpointLayer,
  VIEWPOINT_DIRECTION_LAYER_ID,
  viewDirectionKeyFromFeatures,
} from '@osm-editor-kit/street-imagery-react'

// On map click (add VIEWPOINT_DIRECTION_LAYER_ID to interactiveLayerIds):
getViewpointSession().actions.open({ viewpoints: [viewpointFromPoint([lng, lat])] })
// or for a clicked line: open({ viewpoints: viewpointsFromLine(line, [lng, lat]), line })

const viewpoints = useViewpoints()
const { suggestions } = useViewSuggestions(viewpoints, { maxAgeYears: 2 })
// <ViewpointLayer viewpoints={viewpoints} suggestions={suggestions} activeDirectionKey={…} zoom={zoom} />
// <FloatingPhotoViewer suggestions={suggestions} … >{viewer}</FloatingPhotoViewer>
```

Render `FloatingPhotoViewer` inside a positioned map container. Photos from suggestions open in
`StreetLevelImageryViewer` with `lookAtBearing={suggestion.direction.bearing}`.

**Tailwind:** components use Tailwind classes. Tailwind does not scan `node_modules`, so add to your CSS:

```css
@source '../node_modules/@osm-editor-kit/street-imagery-react';
```

## Look at a place, outline detections

```tsx
import { JUNCTION_DETECTION_GROUPS, matchesAnyGroup, PLACE_TARGET } from '@osm-editor-kit/street-imagery'
import {
  StreetLevelImageryViewer,
  useMapillaryImageDetections,
  useMapillaryMapFeatureImages,
  useMapillaryMapFeaturesNear,
} from '@osm-editor-kit/street-imagery-react'

// Turn any Mapillary photo (360° or flat) towards a junction:
<StreetLevelImageryViewer photo={photo} lookAt={{ lngLat: node, shape: PLACE_TARGET }} … />

// Turn to a detected sign or object and outline it. `value` lets the viewer find the image's own
// detection when Mapillary linked no outline for this image:
const { data } = useMapillaryMapFeatureImages(featureId)
<StreetLevelImageryViewer photo={…} lookAt={{ lngLat: data.feature.lngLat, value: data.feature.value }} … />

// Features around a point, and only the outlines you care about in the shown image:
const { data: features } = useMapillaryMapFeaturesNear(node, { radiusMeters: 40 })
const { data: detections } = useMapillaryImageDetections(photo.photoId, {
  filter: matchesAnyGroup(JUNCTION_DETECTION_GROUPS),
  filterKey: 'junction',
})
<StreetLevelImageryViewer photo={photo} outlines={detections?.map((d) => ({ id: d.id, outline: d.outline }))} … />
```

- Map layers: `filter.mapFeatureValue` limits which signs/objects are drawn: `signGroupFilter(['parking', 'bike'])` for sign groups, or `matchesAnyGroup(…)`.
- Suggested views: `useViewSuggestions(viewpoints, { sources: [mapillaryPhotoSource, streetViewPhotoSource] })`.
- `turnMapillaryViewerTo` / `setMapillaryViewerOutlines` work on a mapillary-js `Viewer` you own.

## A selected sign: viewer, bar and map highlight

Keep the selected sign (`featureId`) and its shown photo in your own state or URL:

```tsx
const { data, shownImage, firstImage } = useSelectedMapillaryFeature({
  featureId,
  shownPhotoId, // the photo the viewer shows now
  minCapturedAt: fromMs, // optional: open the best photo from this time on
})
// Open `firstImage` first: showPhoto(targetImageToPhoto(firstImage))
<MapillaryFeatureBar data={data} shownImage={shownImage} onShow={(image) => showPhoto(targetImageToPhoto(image))} />
<StreetLevelImageryViewer lookAt={{ lngLat: data.feature.lngLat, outline: shownImage?.outline, value: data.feature.value }} … />
// On the map, after StreetLevelImagerySourcesAndLayers: the sign's halo and a line from the camera
<SelectedMapFeatureLayer data={data} shownImage={shownImage} providers={providers} bbox={bbox} zoom={zoom} />
```

A click on a sign dot: `queryStreetImageryFeatures(event).find((hit) => hit.kind === 'mapFeature')?.featureId`.

## Date filter with a slider

`PhotoDateRangeFilter` is the date filter of iD's photo panel as a controlled component: one slider with two handles on a scale that gives recent years more room. It works on plain `{ from?, to? }` days (`YYYY-MM-DD`), the same `DateRange` the layers take as `filter.date`.

```tsx
const { photos } = useAllProviderPhotos(providers, bbox, zoom) // no date: all photos in view

<PhotoDateRangeFilter
  value={date}
  onChange={setDate} // on release of a handle, not while dragging
  capturedAt={photos.map((photo) => photo.capturedAt)} // marks: where photos are
  yearLines={[1, 2, 3, 4]} // lines with a label; a click shows the last N years
  recommendedMaxAgeYears={2} // this line is red
  markers={[{ date: '2024-04-01', label: 'Survey start' }]} // dashed lines for fixed dates
  dateInputs="collapsed" // exact days: 'collapsed' (default), 'open' or 'none'
/>
```

A handle at its end means no limit, so the left end also shows photos older than the slider spans (`maxYears`, default 10). The scale itself is in the core package (`dateSliderPosition`, `dateSliderBins`, …) for a host that draws its own chart. The texts are in `messages.dateFilter`.

## Pick a place on the map to open elsewhere

A button arms a location opener (see `@osm-editor-kit/street-imagery`), the next map click opens the clicked place in that service and disarms; Escape cancels.

```tsx
import {
  LocationPickOnMap,
  useArmedLocationOpenerId,
  useLocationPickActions,
} from '@osm-editor-kit/street-imagery-react'

const armed = useArmedLocationOpenerId() // show it: pressed button, crosshair cursor, a hint on the map
const { toggle, disarm } = useLocationPickActions()

{
  getLocationOpeners().map((opener) => (
    <button key={opener.id} aria-pressed={armed === opener.id} onClick={() => toggle(opener.id)}>
      Open in {opener.label}
    </button>
  ))
}
;<Map cursor={armed ? 'crosshair' : undefined}>
  <LocationPickOnMap />
</Map>
```

The map's own click handlers still run; skip them while `armed` is set if the click should only open the place. When the place is known already (a selected feature), call `openLocationInNewTab` directly instead.

## Photo details dialog (optional)

A modal with everything known about the shown photo: capture, camera, position, source and raw EXIF. It lives in its own entry, so apps that do not import it do not bundle it.

```tsx
import { FloatingViewerInfoButton } from '@osm-editor-kit/street-imagery-react'
import { PHOTO_DETAILS_LABELS, PhotoDetailsDialog } from '@osm-editor-kit/street-imagery-react/photo-details'

<FloatingPhotoViewer
  titleActions={<FloatingViewerInfoButton label={PHOTO_DETAILS_LABELS.en.open} onClick={() => setOpen(true)} />}
  …
/>
<PhotoDetailsDialog open={open} photo={viewerPhoto} onClose={() => setOpen(false)} />
```

`viewerPhoto` is what `onViewerPhoto` of the viewer gives (Mapillary, Panoramax).
