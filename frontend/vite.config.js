import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/messages': 'http://localhost:8000',
      '/gallery': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
      '/login': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})

