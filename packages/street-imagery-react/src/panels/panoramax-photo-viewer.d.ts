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

/** The parts of the viewer's picture metadata we read (a STAC item, reshaped by the viewer). */
type PnxPictureMetadata = {
  id: string
  gps: [number, number]
  horizontalFov?: number
  sequence?: { id?: string | null }
  caption?: { producer?: string[] }
  origInstance?: { instance_name?: string }
  origLinks?: { rel?: string; href?: string }[]
  panorama?: { cropData?: { croppedWidth?: number; fullWidth?: number } }
  properties?: {
    datetime?: string
    datetimetz?: string
    created?: string
    license?: string
    'view:azimuth'?: number
    'quality:horizontal_accuracy'?: number
    'pers:interior_orientation'?: { camera_manufacturer?: string; camera_model?: string }
  }
}

interface PnxPhotoViewerElement extends HTMLElement {
  endpoint: string
  picture: string | null
  sequence: string | null
  'url-parameters': string
  widgets: string
  psv:
    | ({
        getPictureMetadata(): PnxPictureMetadata | null | undefined
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
  PnxPictureMetadata,
  PnxSelectEventDetail,
  PnxViewRotatedEventDetail,
  PnxPictureLoadedEventDetail,
}
