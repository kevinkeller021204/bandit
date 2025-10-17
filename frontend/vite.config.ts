import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // anything under /api goes to Quart
      '/api': {
        target: 'http://localhost:5050', // your Quart port
        changeOrigin: true,
      },
    }
  }
})
