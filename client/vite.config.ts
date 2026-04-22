import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Vite config: React + Tailwind v4, with /api proxy → Express on :3001.
// Path aliases match the tsconfig:
//   @/foo       → client/src/foo
//   @shared/foo → shared/foo
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Anything starting with /api gets forwarded to the Express server.
      // Means the frontend can call '/api/consult' as if same-origin.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
