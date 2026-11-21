import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vendors get their own chunks: they change much less often than the app code, so the browser
// keeps them cached across deploys. Each entry is a chunk name and the packages that go in it.
const vendorChunks = [
  ['framer-motion', ['framer-motion', 'motion-dom', 'motion-utils']],
  ['supabase', ['@supabase']],
  ['tanstack-query', ['@tanstack']],
  ['react-router', ['react-router', 'react-router-dom']],
  ['react', ['react', 'react-dom', 'scheduler']],
]

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: vendorChunks.map(([name, packages]) => ({
            name,
            test: new RegExp('node_modules[\\/](' + packages.join('|') + ')[\\/]'),
          })),
        },
      },
    },
  },
})
