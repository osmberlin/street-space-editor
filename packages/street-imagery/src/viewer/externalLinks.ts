import { getStreetImageryConfig } from '../config'
import { lookAroundDeepLink } from '../providers/adapters/lookaround'
import type { NormalizedPhoto, ProviderId } from '../providers/model'

export const providerExternalLink = (photo: NormalizedPhoto): string => {
  const [lng, lat] = photo.lngLat

  switch (photo.providerId) {
    case 'mapillary':
      return `https://www.mapillary.com/app/?pKey=${encodeURIComponent(photo.photoId)}&focus=photo`
    case 'panoramax':
      return `${getStreetImageryConfig().panoramaxApiBase}/#pic=${encodeURIComponent(photo.photoId)}&focus=pic`
    case 'kartaview':
      if (photo.sequenceId != null && photo.sequenceIndex != null) {
        return `https://kartaview.org/details/${encodeURIComponent(photo.sequenceId)}/${photo.sequenceIndex}`
      }
      return `https://kartaview.org/photo/${encodeURIComponent(photo.photoId)}`
    case 'mapilio':
      return `https://mapilio.com/app?lat=${lat}&lng=${lng}&zoom=17&pId=${encodeURIComponent(photo.photoId)}`
    case 'streetside':
      return `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=18&style=x`
    case 'streetview':
      return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
    case 'lookaround':
      return lookAroundDeepLink(lat, lng)
    case 'vegbilder': {
      const year = photo.viewerYear ?? new Date(photo.capturedAt ?? Date.now()).getUTCFullYear()
      return `https://vegbilder.atlas.vegvesen.no/?year=${year}&lat=${lat}&lng=${lng}&view=image&imageId=${encodeURIComponent(photo.photoId)}`
    }
    case 'mapillary-map-features':
    case 'mapillary-signs':
    default:
      return '#'
  }
}

/** Deep link to a provider's viewer at a map location (no specific photo selected). */
export const providerLocationLink = (
  providerId: ProviderId,
  lat: number,
  lng: number,
  zoom = 14,
): string => {
  switch (providerId) {
    case 'mapillary':
    case 'mapillary-signs':
    case 'mapillary-map-features':
      return `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17&focus=map`
    case 'panoramax':
      return `${getStreetImageryConfig().panoramaxApiBase}/?focus=map&map=${zoom}/${lat}/${lng}`
    case 'kartaview':
      return `https://kartaview.org/map/@${lat},${lng},${zoom}z`
    case 'mapilio':
      return `https://mapilio.com/app?lat=${lat}&lng=${lng}&zoom=17`
    case 'streetside':
      return `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=18&style=x`
    case 'streetview':
      return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
    case 'lookaround':
      return lookAroundDeepLink(lat, lng)
    case 'vegbilder': {
      const year = new Date().getUTCFullYear()
      return `https://vegbilder.atlas.vegvesen.no/?year=${year}&lat=${lat}&lng=${lng}`
    }
  }
}
