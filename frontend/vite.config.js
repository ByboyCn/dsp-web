import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:5099' },
    watch: { usePolling: true, interval: 300 }, // Windows 下规避 EBUSY 崩溃
  },
})
