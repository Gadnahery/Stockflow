import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const electron = process.env.ELECTRON === '1'

export default defineConfig({
  // Relative asset paths for Electron file://; absolute for Vercel web
  base: electron ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
