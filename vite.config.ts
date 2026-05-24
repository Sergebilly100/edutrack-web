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
        // NetworkFirst : on tente le réseau d'abord (timeout court) puis on tombe
        //   sur le cache. C'est ce qu'on veut pour les données dynamiques que le
        //   prof/directeur consulte régulièrement (dashboard, listes).
        // StaleWhileRevalidate : on sert le cache immédiatement et on rafraîchit
        //   en arrière-plan. Utilisé pour les données semi-statiques (policy école,
        //   feature flags) où la fraicheur n'est pas critique.
        // CacheFirst : on sert le cache sans appel réseau si frais. Utilisé pour
        //   les ressources rarement mises à jour (rooms, schedule).
        runtimeCaching: [
          // ── Attendance (lecture) ───────────────────────────────────────
          {
            urlPattern: /\/api\/attendance\/today/,
            handler: "NetworkFirst",
            options: {
              cacheName: "attendance-today-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/v1\/attendance\/(today|active)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "attendance-today-v1-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/v1\/attendance\/history/,
            handler: "NetworkFirst",
            options: {
              cacheName: "attendance-history-v1-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/v1\/attendance\/teacher\/me/,
            handler: "NetworkFirst",
            options: {
              cacheName: "attendance-teacher-me-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/v1\/attendance\/teacher-compliance/,
            handler: "NetworkFirst",
            options: {
              cacheName: "teacher-compliance-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 60 * 60 },
            },
          },
          // ── Élèves, classes, professeurs ────────────────────────────────
          {
            urlPattern: /\/api\/(v1\/)?students/,
            handler: "NetworkFirst",
            options: {
              cacheName: "students-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?classes/,
            handler: "NetworkFirst",
            options: {
              cacheName: "classes-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?teachers/,
            handler: "NetworkFirst",
            options: {
              cacheName: "teachers-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 30 * 60 },
            },
          },
          // ── Dashboard, validations, salaires ────────────────────────────
          {
            urlPattern: /\/api\/(v1\/)?dashboard/,
            handler: "NetworkFirst",
            options: {
              cacheName: "dashboard-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 30 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?validations/,
            handler: "NetworkFirst",
            options: {
              cacheName: "validations-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 30 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?salaries/,
            handler: "NetworkFirst",
            options: {
              cacheName: "salaries-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 30 * 60 },
            },
          },
          // ── Notifications log ──────────────────────────────────────────
          {
            urlPattern: /\/api\/v1\/notifications\/log/,
            handler: "NetworkFirst",
            options: {
              cacheName: "notifications-log-v1-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 30 * 60 },
            },
          },
          // ── Données semi-statiques ─────────────────────────────────────
          {
            urlPattern: /\/api\/(v1\/)?schedule/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "schedule-cache",
              expiration: { maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?school\/(info|public-info)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "school-info-cache",
              expiration: { maxAgeSeconds: 12 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?settings\/public/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "settings-public-cache",
              expiration: { maxAgeSeconds: 12 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?settings/,
            handler: "NetworkFirst",
            options: {
              cacheName: "settings-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 6 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?permissions/,
            handler: "NetworkFirst",
            options: {
              cacheName: "permissions-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 12 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?notifications\/templates/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "notifications-templates-cache",
              expiration: { maxAgeSeconds: 12 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(v1\/)?subscriptions/,
            handler: "NetworkFirst",
            options: {
              cacheName: "subscriptions-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 6 * 60 * 60 },
            },
          },
          // ── Rooms (rare changement, OK en CacheFirst) ──────────────────
          {
            urlPattern: /\/api\/(v1\/)?rooms/,
            handler: "CacheFirst",
            options: {
              cacheName: "rooms-cache",
              expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 },
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
