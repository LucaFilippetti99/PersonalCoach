import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { coachApi } from './server/coachApi.js'

// I dati vivono nella cartella padre (coach/): la webapp li legge e scrive direttamente.
const root = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  plugins: [react(), coachApi({ root })],
  server: { port: 5173 },
  preview: { port: 4173 },
})
