import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { visualizer } from "rollup-plugin-visualizer"

const isAnalyze = process.env.ANALYZE === "true"

export default defineConfig({
  plugins: [
    react(),
    ...(isAnalyze
      ? [
          visualizer({
            filename: "dist/bundle-stats.html",
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/*.png"],
      manifest: {
        name: "EduTrack CI",
        short_name: "EduTrack",
        description: "Suivi des présences scolaires",
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // The app bundle can exceed Workbox's default 2 MiB precache limit in CI builds.
        // Keep precaching enabled by raising the threshold.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/api\/attendance\/today/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "attendance-today-cache",
              expiration: {
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/v1\/attendance\/(today|active)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "attendance-today-v1-cache",
              expiration: {
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/v1\/attendance\/history/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "attendance-history-v1-cache",
              expiration: {
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/v1\/notifications\/log/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "notifications-log-v1-cache",
              expiration: {
                maxAgeSeconds: 30 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/schedule/,
            handler: "CacheFirst",
            options: {
              cacheName: "schedule-cache",
              expiration: {
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/teachers/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "teachers-cache",
              expiration: {
                maxAgeSeconds: 30 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/rooms/,
            handler: "CacheFirst",
            options: {
              cacheName: "rooms-cache",
              expiration: {
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "chart-vendor": ["recharts"],
          "qr-vendor": ["html5-qrcode", "qrcode.react"],
          "query-vendor": ["@tanstack/react-query", "@tanstack/react-table"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    exclude: ["e2e/**", "edutrack-api/**", "node_modules/**", "dist/**"],
  },
})
