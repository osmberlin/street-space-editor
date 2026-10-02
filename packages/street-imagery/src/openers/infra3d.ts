import { peekStreetImageryConfig } from '../config'

/**
 * Deep links into infra3D Edit (tested 2026-10-01). Only people with an infra3D account get in;
 * everyone else lands on the infra3D login page.
 */
export const INFRA3D_EDIT_URL = 'https://app.infra3d.com/edit/'

export type Infra3dPointTo = {
  type: 'pano'
  lat: number
  lon: number
  fov: number
}

/**
 * `jumpTo`, `lookAt` and `imageKey` exclude each other; only `imageKey` takes `pointTo`.
 *
 * - `jumpTo`: the image nearest to the position.
 * - `lookAt`: the image nearest to the position (within 100 m), turned to look at it. Without a
 *   `height` (meters above sea level) infra3D looks at the ground there, which is what a map click
 *   means; a wrong height looks into the sky or the ground (40 m is already too high in Berlin
 *   Mitte, tested 2026-10-02).
 * - `imageKey`: one image by its UUID.
 */
export type Infra3dUrlOptions = (
  | { mode: 'jumpTo'; lng: number; lat: number }
  | { mode: 'lookAt'; lng: number; lat: number; height?: number }
  | { mode: 'imageKey'; imageKey: string; pointTo?: Infra3dPointTo }
) & {
  /** Overrides `infra3d.projectUid` of the street imagery config. */
  projectUid?: string
}

/** The project from `setStreetImageryConfig({ infra3d })`; `undefined` when the host has none. */
export const getInfra3dProjectUid = (): string | undefined =>
  peekStreetImageryConfig()?.infra3d?.projectUid

/** infra3D wants JSON params encoded with `encodeURIComponent` (`URLSearchParams` differs on spaces). */
const jsonParam = (name: string, value: object) =>
  `${name}=${encodeURIComponent(JSON.stringify(value))}`

/** With EPSG 4326, infra3D's `easting` is the longitude and `northing` the latitude. */
const wgs84 = (lng: number, lat: number) => ({ easting: lng, northing: lat })

export const buildInfra3dUrl = (options: Infra3dUrlOptions): string => {
  const projectUid = options.projectUid ?? getInfra3dProjectUid()
  if (!projectUid) {
    throw new Error(
      'infra3D project is not set. Pass `projectUid` or `createStreetImageryConfig({ infra3d: { projectUid } })`.',
    )
  }

  const params = [`projectUID=${encodeURIComponent(projectUid)}`]
  switch (options.mode) {
    case 'jumpTo':
      params.push(jsonParam('jumpTo', { ...wgs84(options.lng, options.lat), epsg: 4326 }))
      break
    case 'lookAt':
      params.push(
        jsonParam('lookAt', {
          ...wgs84(options.lng, options.lat),
          ...(options.height == null ? {} : { height: options.height }),
          epsg: 4326,
        }),
      )
      break
    case 'imageKey':
      params.push(`imageKey=${encodeURIComponent(options.imageKey)}`)
      if (options.pointTo) {
        params.push(jsonParam('pointTo', options.pointTo))
      }
      break
  }

  return `${INFRA3D_EDIT_URL}?${params.join('&')}`
}
