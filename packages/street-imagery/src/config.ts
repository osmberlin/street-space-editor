import type { Bbox } from './providers/model'

export type StreetImageryConfig = {
  mapillaryToken: string
  panoramaxApiBase: string
  /**
   * Google Maps Platform browser key for Street View. It ships in the JS bundle anyway, so the
   * host app passes it here; protect it with HTTP-referrer and API restrictions.
   */
  googleMapsApiKey?: string
  /**
   * Bing Maps key for the Streetside overlay. Without it Streetside is an opener only. Microsoft
   * issues no new keys; existing enterprise keys work until June 30, 2028.
   */
  bingMapsKey?: string
  /**
   * Where links to other services open: a new browser tab (default) or a separate window.
   */
  openLinksIn?: 'tab' | 'window'
  /**
   * infra3D projects for the "open in infra3D" links. Without one there is no infra3D opener.
   */
  infra3d?: Infra3dConfig
}

/** One infra3D project the host links to. The package knows no projects of its own. */
export type Infra3dProject = {
  /** The `projectUID` of the infra3D URL. */
  uid: string
  /** The opener's label, shown as it is, e.g. "infra3D Berlin". */
  label: string
  /** The only area the project has imagery in. Unset: the opener covers every place. */
  bbox?: Bbox
}

export type Infra3dConfig = {
  /** One "open in infra3D" opener per project, in this order. */
  projects: Infra3dProject[]
}

const DEFAULT_PANORAMAX_API_BASE = 'https://api.panoramax.xyz'

let activeConfig: StreetImageryConfig | null = null

export const createStreetImageryConfig = (input: {
  mapillaryToken: string
  panoramaxApiBase?: string
  googleMapsApiKey?: string
  bingMapsKey?: string
  openLinksIn?: 'tab' | 'window'
  infra3d?: Infra3dConfig
}): StreetImageryConfig => ({
  mapillaryToken: input.mapillaryToken,
  googleMapsApiKey: input.googleMapsApiKey || undefined,
  bingMapsKey: input.bingMapsKey || undefined,
  openLinksIn: input.openLinksIn,
  infra3d: input.infra3d && input.infra3d.projects.length > 0 ? input.infra3d : undefined,
  panoramaxApiBase: (input.panoramaxApiBase ?? DEFAULT_PANORAMAX_API_BASE).replace(/\/$/, ''),
})

export const setStreetImageryConfig = (config: StreetImageryConfig): void => {
  activeConfig = config
}

export const getStreetImageryConfig = (): StreetImageryConfig => {
  if (!activeConfig) {
    throw new Error(
      'Street imagery config is not set. Call setStreetImageryConfig(createStreetImageryConfig(...)) before use.',
    )
  }
  return activeConfig
}

/** The Panoramax server of the config; the public one when the host set no config. */
export const getPanoramaxApiBase = (): string =>
  activeConfig?.panoramaxApiBase ?? DEFAULT_PANORAMAX_API_BASE

/** Like `getStreetImageryConfig`, but `null` instead of throwing when nothing is configured. */
export const peekStreetImageryConfig = (): StreetImageryConfig | null => activeConfig
