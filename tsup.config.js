import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    nyaa: 'src/nyaa.js',
    animetosho: 'src/animetosho.js',
    seadex: 'src/seadex.js',
    subsplease: 'src/subsplease.js',
    yameii: 'src/yameii.js'
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2020',
  platform: 'neutral',
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  clean: true,
  dts: false
})
