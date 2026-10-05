import * as m from '@app/paraglide/messages'
import { useAllProviderPhotos, useMapViewportBbox } from '@osm-editor-kit/street-imagery-react'
import clsx from 'clsx'
import { Camera, Check } from 'lucide-react'
import { useMemo } from 'react'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHeading,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSection,
} from '../../components/catalyst/dropdown'
import { useUiLocale } from '../../i18n/useUiLocale'
import { formatPhotoFilterDate } from './format-photo-filter-date'
import { MAIN_MAP_ID } from './map-ids'
import { useMapViewport } from './map-viewport'
import { mapControlButtonClassName } from './mobileMapChrome.const'
import { PHOTO_AGE_LEGEND, type PhotoAgeBucketId } from './photo-age-style'
import {
  fromDateToSliderValue,
  photoCaptureTimesToSliderTicks,
  resolvePhotoDateFilter,
  sliderValueToFromDate,
} from './photo-date-slider'
import {
  DEFAULT_PHOTO_TYPES,
  DEFAULT_SIGN_GROUPS,
  EDITOR_IMAGERY_LAYERS,
  EDITOR_SIGNS_LAYER,
  SIGN_GROUP_IDS,
  type EditorImageryLayer,
  type EditorPhotoType,
  type SignGroupId,
} from './street-imagery-search-params'
import { useModeSearchNavigation } from './use-mode-search-navigation'

const PROVIDER_LABEL: Record<EditorImageryLayer, () => string> = {
  mapillary: () => m.street_imagery_provider_mapillary(),
  panoramax: () => m.street_imagery_provider_panoramax(),
  'mapillary-signs': () => m.street_imagery_provider_mapillary_signs(),
}

const SIGN_GROUP_LABEL: Record<SignGroupId, () => string> = {
  parking: () => m.street_imagery_sign_group_parking(),
  bike: () => m.street_imagery_sign_group_bike(),
  speed: () => m.street_imagery_sign_group_speed(),
  access: () => m.street_imagery_sign_group_access(),
  other: () => m.street_imagery_sign_group_other(),
}

const AGE_LEGEND_LABEL: Record<PhotoAgeBucketId, () => string> = {
  current: () => m.street_imagery_legend_age_current(),
  mid: () => m.street_imagery_legend_age_mid(),
  old: () => m.street_imagery_legend_age_old(),
}

/** Single map-control button: provider toggles + photo filters in one dropdown. */
export function MapStreetImageryControls() {
  const { search, updateSearch } = useModeSearchNavigation()
  const uiLocale = useUiLocale()
  const map = useMapViewport()
  const bbox = useMapViewportBbox(MAIN_MAP_ID, map)
  const enabled = new Set(search.photos ?? [])
  const photoTypes = search.photoTypes ?? [...DEFAULT_PHOTO_TYPES]
  const photoTypeSet = new Set(photoTypes)
  const anyEnabled = (search.photos?.length ?? 0) > 0
  // Absent `photoDate` while photos are on → default 3-year freshness window.
  const fromDate = resolvePhotoDateFilter(search.photoDate, anyEnabled)?.from
  const sliderValue = fromDateToSliderValue(fromDate)

  // iD: ticks from viewport captures *without* the date filter (type filter still applies).
  const { photos: viewportPhotosForTicks } = useAllProviderPhotos(
    search.photos ?? [],
    anyEnabled ? bbox : null,
    map.zoom,
    photoTypes,
    undefined,
  )
  const sliderTicks = useMemo(
    () => photoCaptureTimesToSliderTicks(viewportPhotosForTicks.map((photo) => photo.capturedAt)),
    [viewportPhotosForTicks],
  )

  const toggleProvider = (provider: EditorImageryLayer) => {
    const next = new Set(search.photos ?? [])
    if (next.has(provider)) next.delete(provider)
    else next.add(provider)

    const providers = EDITOR_IMAGERY_LAYERS.filter((id) => next.has(id))
    updateSearch(
      {
        photos: providers.length > 0 ? providers : undefined,
        photo: providers.length === 0 ? undefined : search.photo,
      },
      { replace: true },
    )
  }

  const togglePhotoType = (type: EditorPhotoType, checked: boolean) => {
    const next = new Set(search.photoTypes ?? [...DEFAULT_PHOTO_TYPES])
    if (checked) next.add(type)
    else next.delete(type)

    const resolved = DEFAULT_PHOTO_TYPES.filter((value) => next.has(value))
    updateSearch(
      {
        photoTypes: resolved.length > 0 ? resolved : [...DEFAULT_PHOTO_TYPES],
      },
      { replace: true },
    )
  }

  const signGroups = new Set(search.signGroups)
  const toggleSignGroup = (group: SignGroupId, checked: boolean) => {
    const next = new Set(search.signGroups)
    if (checked) next.add(group)
    else next.delete(group)
    const resolved = SIGN_GROUP_IDS.filter((id) => next.has(id))
    updateSearch(
      { signGroups: resolved.length > 0 ? resolved : [...DEFAULT_SIGN_GROUPS] },
      { replace: true },
    )
  }

  const updateFromSlider = (raw: string) => {
    const nextFrom = sliderValueToFromDate(Number.parseFloat(raw))
    updateSearch(
      {
        // iD primary control sets only `from` (“newer than”); `all` is explicit so
        // omitting `photoDate` can mean the default 3-year window.
        photoDate: nextFrom ? { from: nextFrom } : { all: true },
      },
      { replace: true },
    )
  }

  const formattedFrom = fromDate ? formatPhotoFilterDate(fromDate, uiLocale) : null
  const dateLabel = formattedFrom
    ? m.street_imagery_filter_date_label({ date: formattedFrom })
    : m.street_imagery_filter_date_all()

  return (
    <Dropdown>
      <DropdownButton
        as="button"
        type="button"
        aria-label={m.street_imagery_control_aria()}
        aria-pressed={anyEnabled}
        className={clsx(
          mapControlButtonClassName,
          anyEnabled && 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
        )}
        title={m.street_imagery_control_aria()}
      >
        <Camera className="size-5" aria-hidden />
      </DropdownButton>
      <DropdownMenu anchor={{ to: 'top end', gap: 8, padding: 12 }} className="z-50 w-72">
        <DropdownSection>
          <DropdownHeading>{m.street_imagery_providers_heading()}</DropdownHeading>
          {EDITOR_IMAGERY_LAYERS.map((provider) => (
            <DropdownItem key={provider} onClick={() => toggleProvider(provider)}>
              <Check
                data-slot="icon"
                className={enabled.has(provider) ? 'size-4' : 'size-4 opacity-0'}
                aria-hidden
              />
              <DropdownLabel>{PROVIDER_LABEL[provider]()}</DropdownLabel>
            </DropdownItem>
          ))}
        </DropdownSection>
        <DropdownDivider />
        <DropdownSection>
          <DropdownHeading>{m.street_imagery_legend_heading()}</DropdownHeading>
          <div className="flex flex-col gap-1.5 px-3 py-2" role="list">
            {PHOTO_AGE_LEGEND.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 text-sm text-zinc-950 dark:text-white"
                role="listitem"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-zinc-950/15 dark:ring-white/20"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden
                />
                <span>{AGE_LEGEND_LABEL[entry.id]()}</span>
              </div>
            ))}
          </div>
        </DropdownSection>
        <DropdownDivider />
        <DropdownSection>
          <DropdownHeading>{m.street_imagery_filter_heading()}</DropdownHeading>
          <DropdownItem
            disabled={!anyEnabled}
            onClick={() => togglePhotoType('flat', !photoTypeSet.has('flat'))}
          >
            <Check
              data-slot="icon"
              className={photoTypeSet.has('flat') ? 'size-4' : 'size-4 opacity-0'}
              aria-hidden
            />
            <DropdownLabel>{m.street_imagery_filter_flat()}</DropdownLabel>
          </DropdownItem>
          <DropdownItem
            disabled={!anyEnabled}
            onClick={() => togglePhotoType('pano', !photoTypeSet.has('pano'))}
          >
            <Check
              data-slot="icon"
              className={photoTypeSet.has('pano') ? 'size-4' : 'size-4 opacity-0'}
              aria-hidden
            />
            <DropdownLabel>{m.street_imagery_filter_pano()}</DropdownLabel>
          </DropdownItem>
        </DropdownSection>
        {enabled.has(EDITOR_SIGNS_LAYER) ? (
          <>
            <DropdownDivider />
            <DropdownSection>
              <DropdownHeading>{m.street_imagery_sign_groups_heading()}</DropdownHeading>
              {SIGN_GROUP_IDS.map((group) => (
                <DropdownItem
                  key={group}
                  onClick={() => toggleSignGroup(group, !signGroups.has(group))}
                >
                  <Check
                    data-slot="icon"
                    className={signGroups.has(group) ? 'size-4' : 'size-4 opacity-0'}
                    aria-hidden
                  />
                  <DropdownLabel>{SIGN_GROUP_LABEL[group]()}</DropdownLabel>
                </DropdownItem>
              ))}
            </DropdownSection>
          </>
        ) : null}
        <DropdownDivider />
        <DropdownSection>
          <DropdownHeading>{m.street_imagery_filter_date()}</DropdownHeading>
          <div
            className="flex flex-col gap-2 px-3 py-2"
            // Keep the menu open while dragging the range input.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Fixed two-line layout + tabular date so the slider row doesn’t jump while dragging. */}
            <div className="min-h-11 text-xs text-zinc-500 dark:text-zinc-300">
              {formattedFrom ? (
                <>
                  <span className="block">{m.street_imagery_filter_date_prefix()}</span>
                  <span className="mt-0.5 block font-medium tabular-nums tracking-tight text-zinc-700 dark:text-zinc-200">
                    {formattedFrom}
                  </span>
                </>
              ) : (
                <span className="block">{m.street_imagery_filter_date_all()}</span>
              )}
            </div>
            {/* Capture-age tick strip (iD uses <datalist>; we draw marks so they stay visible). */}
            <div className="relative h-2 w-full" aria-hidden>
              {sliderTicks
                .filter((tick) => tick > 0 && tick < 1)
                .map((tick) => (
                  <span
                    key={tick}
                    className="absolute top-0 h-full w-px -translate-x-1/2 bg-zinc-400 dark:bg-zinc-500"
                    // RTL track: 0 (today) on the right, 1 (all) on the left — same as the range input.
                    style={{ left: `${tick * 100}%` }}
                  />
                ))}
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              list="street-imagery-photo-date-slider"
              disabled={!anyEnabled}
              value={sliderValue}
              aria-label={m.street_imagery_filter_date()}
              aria-valuetext={dateLabel}
              // Match iD: LTR UI uses RTL track so “all” sits on the left.
              className="w-full accent-emerald-600 disabled:opacity-50"
              style={{ direction: 'rtl' }}
              onChange={(event) => updateFromSlider(event.target.value)}
            />
            <datalist id="street-imagery-photo-date-slider">
              {sliderTicks.map((tick) => (
                <option key={tick} value={tick} />
              ))}
            </datalist>
          </div>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  )
}
