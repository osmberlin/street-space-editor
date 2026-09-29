import { redirectLegacyMapHash } from '@osm-editor-kit/osm-map-url'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { createAppQueryClient } from './lib/query-client'
import { routeTree } from './routeTree.gen'
import { appRouterSearch } from './shell/map/app-router-search'
import { initStreetImageryConfig } from './shell/map/street-imagery-config'
import './styles/tailwind.css'
import './styles/main.scss'

// MapLibre 6 loads its worker as a separate file next to the main bundle; Vite does not emit it,
// so point at an explicitly bundled copy (otherwise the deployed map never starts).
setWorkerUrl(workerUrl)

redirectLegacyMapHash()
initStreetImageryConfig()

const basepath = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

const router = createRouter({
  routeTree,
  basepath,
  trailingSlash: 'never',
  parseSearch: appRouterSearch.parse,
  stringifySearch: appRouterSearch.stringify,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = createAppQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
)
