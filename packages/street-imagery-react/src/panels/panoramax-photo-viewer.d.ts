type PnxSelectEventDetail = {
  seqId: string | null
  picId: string | null
  prevSeqId?: string | null
  prevPicId?: string | null
}

type PnxViewRotatedEventDetail = {
  x: number
  y: number
  z: number
}

type PnxPictureLoadedEventDetail = {
  picId: string
  lon: number
  lat: number
  x: number
  y: number
  z: number
  first?: boolean
}

interface PnxPhotoViewerElement extends HTMLElement {
  endpoint: string
  picture: string | null
  sequence: string | null
  'url-parameters': string
  widgets: string
  psv:
    | ({
        getPictureMetadata(): { gps: [number, number]; id: string } | null | undefined
        resize(): void
        dataHelper: { zoomLevelToFov(level: number): number }
      } & import('./panoramaxLimitPanning').PsvForPanLimit)
    | null
  select(seqId?: string | null, picId?: string | null, force?: boolean): void
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'pnx-photo-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<PnxPhotoViewerElement> & {
          endpoint?: string
          picture?: string
          sequence?: string
          'url-parameters'?: string
          widgets?: string
        },
        PnxPhotoViewerElement
      >
    }
  }
}

export type {
  PnxPhotoViewerElement,
  PnxSelectEventDetail,
  PnxViewRotatedEventDetail,
  PnxPictureLoadedEventDetail,
}
