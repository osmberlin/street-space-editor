import {
  DataProviderBase,
  S2GeometryProvider,
  type ClusterContract,
  type CoreImagesContract,
  type ImageEnt,
  type ImagesContract,
  type ImageTilesContract,
  type ImageTilesRequestContract,
  type MeshContract,
  type SequenceContract,
  type SpatialImagesContract,
} from 'mapillary-js'
import {
  isPanoramaxItemSpherical,
  panoramaxItemFocal,
  panoramaxItemNeighbour,
  panoramaxLevelNeedsOriginal,
  panoramaxTileRect,
  panoramaxTilesOfLevel,
  panoramaxViewerSize,
  panoramaxItemImageUrl,
  type PanoramaxItem,
} from './panoramaxItem'

export type PanoramaxDataProviderOptions = {
  /** The Panoramax API, e.g. `https://api.panoramax.xyz/api`. */
  endpoint: string
}

/** The search takes the ids in the URL; this many keep it well below common URL limits. */
const IDS_PER_REQUEST = 40

const SEQUENCE_PREFIX = 'panoramax-around:'

const fetchFile = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Panoramax picture file: HTTP ${response.status}`)
  }
  return response
}

const TILE_PREFIX = 'panoramax-tile:'

/** Decoded files to keep for cutting tiles: an original 360° picture is some 150 MB of memory. */
const PICTURES_KEPT = 3

/**
 * Lets a mapillary-js `Viewer` show Panoramax pictures: pass it as the viewer's `dataProvider`.
 *
 * A picture opens with its `sd` file (2048 px wide). The viewer then asks for tiles of the part in
 * view; they are cut here, in the browser. Only when the view needs more detail than `sd` has is
 * the original file loaded for that, once. (Panoramax has tiles of its own for 360° pictures only,
 * in another layout.)
 *
 * Panoramax has no 3D reconstruction, so the viewer places each picture by its compass direction
 * and offers the steps along the sequence only, not the arrows to pictures nearby.
 *
 * A Panoramax sequence can hold thousands of pictures and the API has no short list of them, so
 * the viewer never gets the whole sequence. Every picture gets a short one of its own: the
 * picture before, the picture, the picture after. `Image.sequenceId` of the viewer is therefore
 * not the Panoramax sequence; use `getItem(id).collection`.
 */
export class PanoramaxDataProvider extends DataProviderBase {
  private readonly endpoint: string
  private readonly items = new Map<string, PanoramaxItem>()
  private readonly itemRequests = new Map<string, Promise<void>>()
  private readonly imageBuffers = new Map<string, Promise<ArrayBuffer>>()
  private readonly pictures = new Map<string, Promise<ImageBitmap>>()

  constructor({ endpoint }: PanoramaxDataProviderOptions) {
    super(new S2GeometryProvider())
    this.endpoint = endpoint.replace(/\/$/, '')
  }

  /** The Panoramax data of a picture the viewer has loaded. */
  getItem(imageId: string): PanoramaxItem | undefined {
    return this.items.get(imageId)
  }

  // Only the arrows to pictures nearby need these, and those need a 3D reconstruction.
  override getCoreImages(cellId: string): Promise<CoreImagesContract> {
    return Promise.resolve({ cell_id: cellId, images: [] })
  }

  override async getImages(imageIds: string[]): Promise<ImagesContract> {
    const items = await this.loadItems(imageIds)
    return items.map((item) => ({ node: this.toImageEnt(item), node_id: item.id }))
  }

  override getSpatialImages(imageIds: string[]): Promise<SpatialImagesContract> {
    return this.getImages(imageIds)
  }

  override async getSequence(sequenceId: string): Promise<SequenceContract> {
    const imageId = sequenceId.slice(SEQUENCE_PREFIX.length)
    const [item] = await this.loadItems([imageId])
    if (!item) {
      throw new Error(`Panoramax picture ${imageId} not found`)
    }
    const around = [
      panoramaxItemNeighbour(item, 'prev'),
      item.id,
      panoramaxItemNeighbour(item, 'next'),
    ]
    return { id: sequenceId, image_ids: around.filter((id) => id != null) }
  }

  // The viewer asks for the same file more than once while it starts; one download serves all.
  override getImageBuffer(url: string): Promise<ArrayBuffer> {
    const running = this.imageBuffers.get(url)
    if (running) {
      return running
    }
    const load = url.startsWith(TILE_PREFIX)
      ? this.cutTile(url)
      : fetchFile(url).then((response) => response.arrayBuffer())
    const request = load.finally(() => this.imageBuffers.delete(url))
    this.imageBuffers.set(url, request)
    return request
  }

  override async getImageTiles({
    imageId,
    z,
  }: ImageTilesRequestContract): Promise<ImageTilesContract> {
    const [item] = await this.loadItems([imageId])
    const tiles = item ? panoramaxTilesOfLevel(panoramaxViewerSize(item), z) : []
    return {
      node_id: imageId,
      node: tiles.map(({ x, y }) => ({ url: `${TILE_PREFIX}${imageId}/${z}/${x}/${y}`, x, y, z })),
    }
  }

  private async cutTile(url: string): Promise<ArrayBuffer> {
    const [imageId = '', z, x, y] = url.slice(TILE_PREFIX.length).split('/')
    const item = this.items.get(imageId)
    if (!item) {
      throw new Error(`Panoramax picture ${imageId} not loaded`)
    }
    const size = panoramaxViewerSize(item)
    const { hd, sd } = item.assets ?? {}
    // Low levels are no sharper than the `sd` file: no need to load the original for them.
    const file = (panoramaxLevelNeedsOriginal(size, Number(z)) ? hd : sd) ?? hd ?? sd
    const original = await this.loadPicture(file?.href ?? '')
    const rect = panoramaxTileRect(
      size,
      { x: Number(x), y: Number(y), z: Number(z) },
      { width: original.width, height: original.height },
    )
    const canvas = new OffscreenCanvas(rect.outWidth, rect.outHeight)
    canvas
      .getContext('2d')
      ?.drawImage(
        original,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        rect.outWidth,
        rect.outHeight,
      )
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    return blob.arrayBuffer()
  }

  private loadPicture(url: string): Promise<ImageBitmap> {
    const known = this.pictures.get(url)
    if (known) {
      return known
    }
    const picture = fetchFile(url)
      .then((response) => response.blob())
      .then((blob) => createImageBitmap(blob))
    this.pictures.set(url, picture)
    picture.catch(() => this.pictures.delete(url))
    for (const [oldUrl, old] of [...this.pictures].slice(0, -PICTURES_KEPT)) {
      this.pictures.delete(oldUrl)
      void old.then((bitmap) => bitmap.close()).catch(() => {})
    }
    return picture
  }

  override getMesh(): Promise<MeshContract> {
    return Promise.resolve({ faces: [], vertices: [] })
  }

  override getCluster(url: string): Promise<ClusterContract> {
    return Promise.resolve({ id: url, points: {}, reference: { lat: 0, lng: 0, alt: 0 } })
  }

  private async loadItems(imageIds: string[]): Promise<PanoramaxItem[]> {
    const missing = [
      ...new Set(imageIds.filter((id) => !this.items.has(id) && !this.itemRequests.has(id))),
    ]
    for (let start = 0; start < missing.length; start += IDS_PER_REQUEST) {
      const ids = missing.slice(start, start + IDS_PER_REQUEST)
      const request = fetch(`${this.endpoint}/search?ids=${ids.join(',')}&limit=${ids.length}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Panoramax search: HTTP ${response.status}`)
          }
          return response.json() as Promise<{ features?: PanoramaxItem[] }>
        })
        .then((result) => {
          for (const item of result.features ?? []) {
            this.items.set(item.id, item)
          }
        })
        .finally(() => {
          for (const id of ids) {
            this.itemRequests.delete(id)
          }
        })
      for (const id of ids) {
        this.itemRequests.set(id, request)
      }
    }
    await Promise.all(imageIds.map((id) => this.itemRequests.get(id)))
    return imageIds.flatMap((id) => this.items.get(id) ?? [])
  }

  private toImageEnt(item: PanoramaxItem): ImageEnt {
    const [lng, lat] = item.geometry.coordinates
    const [width, height] = panoramaxViewerSize(item)
    const spherical = isPanoramaxItemSpherical(item)
    const properties = item.properties ?? {}
    const none = { id: '', url: '' }
    return {
      id: item.id,
      geometry: { lat, lng },
      sequence: { id: `${SEQUENCE_PREFIX}${item.id}` },
      altitude: 0,
      camera_type: spherical ? 'spherical' : 'perspective',
      camera_parameters: spherical ? [] : [panoramaxItemFocal(item), 0, 0],
      captured_at: Date.parse(properties.datetime ?? '') || 0,
      compass_angle: properties['view:azimuth'] ?? 0,
      cluster: none,
      creator: { id: '', username: properties['geovisio:producer'] ?? '' },
      // Panoramax serves its pictures upright.
      exif_orientation: 1,
      width,
      height,
      mesh: none,
      owner: { id: '' },
      thumb: {
        id: item.id,
        url: panoramaxItemImageUrl(item),
      },
    }
  }
}
