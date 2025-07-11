import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy USGS API calls to avoid CORS issues
      '/api/usgs': {
        target: 'https://waterservices.usgs.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/usgs/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Proxy EPA API calls to avoid CORS issues
      '/api/epa': {
        target: 'https://www.waterqualitydata.us',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/epa/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('EPA Proxy error:', err);
          });
        },
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
}) 