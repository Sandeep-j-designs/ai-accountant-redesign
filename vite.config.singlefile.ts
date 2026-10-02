import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds a single self-contained index.html (JS/CSS/fonts inlined as data URIs)
// into dist-single/. Run: npx vite build --config vite.config.singlefile.ts
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100 * 1024 * 1024, // inline everything, incl. fonts
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
})
