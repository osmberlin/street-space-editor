// Panoramax's own viewer (`@panoramax/web-viewer`, built on Photo Sphere Viewer) as a panel.
// `StreetLevelImageryViewer` shows Panoramax pictures in the Mapillary viewer instead; pass this
// panel as its `panoramaxPanel` to get Panoramax's viewer back. It is an entry of its own so
// that only hosts which import it need `@panoramax/web-viewer` and its build setup.
export { PanoramaxWebViewerPanel } from '../panels/PanoramaxWebViewerPanel'
