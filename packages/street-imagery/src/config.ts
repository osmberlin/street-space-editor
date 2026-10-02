export type StreetImageryConfig = {
  mapillaryToken: string
  panoramaxApiBase: string
  /**
   * Google Maps Platform browser key for Street View. It ships in the JS bundle anyway, so the
   * host app passes it here; protect it with HTTP-referrer and API restrictions.
   */
  googleMapsApiKey?: string
  /**
   * infra3D projects for the "open in infra3D" links. Without one there is no infra3D opener.
   */
  infra3d?: Infra3dConfig
}

/** One infra3D project the host links to: the id of the URL (`projectUID`) and a name to show. */
export type Infra3dProject = {
  uid: string
  name: string
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
  infra3d?: Infra3dConfig
}): StreetImageryConfig => ({
  mapillaryToken: input.mapillaryToken,
  googleMapsApiKey: input.googleMapsApiKey || undefined,
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

/** Like `getStreetImageryConfig`, but `null` instead of throwing when nothing is configured. */
export const peekStreetImageryConfig = (): StreetImageryConfig | null => activeConfig
