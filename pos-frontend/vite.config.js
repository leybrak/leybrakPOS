import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      workbox: {
        // Rutas que NO son de la SPA: el SW no debe servir index.html aquí,
        // las deja pasar a nginx (páginas/archivos estáticos reales).
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/mp-callback\//,
          /^\/descargar/,    // página de descarga del APK
          /^\/media\//,      // el APK y otros archivos servidos por nginx
          /^\/legal\.html/,  // página legal estática
        ],
        runtimeCaching: [],
        skipWaiting: true,      // ← AGREGA
        clientsClaim: true,     // ← AGREGA
      },
      manifest: {
        name: 'Brava POS ERP',
        short_name: 'BravaPOS',
        description: 'Sistema ERP y Punto de Venta',
        theme_color: '#ff5a1f',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})