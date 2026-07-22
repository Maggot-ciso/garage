/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// CAP_BUILD=1 builds for the native shell: assets are loaded relative to the
// app bundle, and the PWA service worker is dropped — Capacitor already serves
// from a local secure origin, so a second caching layer only adds a way for the
// app to serve a stale build after an update.
const nativeShell = process.env.CAP_BUILD === '1'

// Single version source: package.json. Bump with `npm version patch|minor|major`;
// the UI (Settings footer) and the .ipa (build-ipa.sh) both read from it.
import { readFileSync } from 'node:fs'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: nativeShell ? './' : '/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    ...(nativeShell ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'GarageBook',
        short_name: 'GarageBook',
        description: 'Car logbook and smart assistant. All data stays on your device.',
        theme_color: '#dc2626',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    })]),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Only this checkout's own tests. Agent worktrees live under
    // .claude/worktrees/ inside the repo and would otherwise be scanned too,
    // silently doubling the suite and reporting another branch's results.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
