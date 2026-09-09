import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 🛠️ Antes: 'autoUpdate' + skipWaiting:true — el SW nuevo se activaba
      // solo, sin avisar a nadie. Una pestaña ya abierta seguía corriendo el
      // JS viejo mientras el SW nuevo (con assets nuevos) tomaba control por
      // debajo — mezcla silenciosa de versión vieja de código con cache
      // nueva. 'prompt' deja el SW nuevo "esperando" hasta que el usuario
      // confirma (ver useActualizacionDisponible.js + BannerActualizacion.jsx),
      // momento en el que recién se le manda skipWaiting y se recarga limpio.
      registerType: 'prompt',
      // El registro lo hace a mano ActualizacionDisponible.jsx (useRegisterSW)
      // para poder mostrar el aviso y esperar la confirmación del usuario —
      // con el script auto-inyectado (default) se registraría el SW por
      // duplicado sin ese control.
      injectRegister: false,
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
        clientsClaim: true,     // apenas el usuario confirma y el SW nuevo activa, toma control ya mismo
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