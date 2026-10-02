export type StreetImageryConfig = {
  mapillaryToken: string
  panoramaxApiBase: string
  /**
   * Google Maps Platform browser key for Street View. It ships in the JS bundle anyway, so the
   * host app passes it here; protect it with HTTP-referrer and API restrictions.
   */
  googleMapsApiKey?: string
}

const DEFAULT_PANORAMAX_API_BASE = 'https://api.panoramax.xyz'

let activeConfig: StreetImageryConfig | null = null

export const createStreetImageryConfig = (input: {
  mapillaryToken: string
  panoramaxApiBase?: string
  googleMapsApiKey?: string
}): StreetImageryConfig => ({
  mapillaryToken: input.mapillaryToken,
  googleMapsApiKey: input.googleMapsApiKey || undefined,
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
