import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', 'photo-details': 'src/photo-details/index.ts' },
  format: ['esm'],
  dts: false,
  clean: true,
  treeshake: true,
  sourcemap: false,
  splitting: true,
  external: [
    /@osm-editor-kit\//,
    /^@tanstack\//,
    /^@panoramax\//,
    'mapillary-js',
    'maplibre-gl',
    'react',
    'react-dom',
    'react-map-gl',
    'zustand',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
