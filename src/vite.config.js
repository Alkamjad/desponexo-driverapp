import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: 'all'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})