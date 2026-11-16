import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ammora-api': {
        target: 'https://ammora-giwa-sepolia-data.fly.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ammora-api/, ''),
      },
    },
  },
})
