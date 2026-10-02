import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'providers/all': 'src/providers/all.ts',
    'providers/mapillary': 'src/providers/adapters/mapillary.ts',
    'providers/mapillary-signs': 'src/providers/adapters/mapillary-signs.ts',
    'providers/mapillary-map-features': 'src/providers/adapters/mapillary-map-features.ts',
    'providers/panoramax': 'src/providers/adapters/panoramax.ts',
    'providers/kartaview': 'src/providers/adapters/kartaview.ts',
    'providers/mapilio': 'src/providers/adapters/mapilio.ts',
    'providers/streetside': 'src/providers/adapters/streetside.ts',
    'providers/vegbilder': 'src/providers/adapters/vegbilder.ts',
  },
  splitting: true,
  format: ['esm'],
  dts: false,
  clean: true,
  treeshake: true,
  sourcemap: false,
  external: ['@mapbox/vector-tile', 'pbf', 'maplibre-gl', 'date-fns', /^date-fns\//],
})
