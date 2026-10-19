/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true' && Boolean(repoName)

const productionCsp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
const developmentCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"

export default defineConfig(({ command }) => ({
  plugins: [
    {
      name: 'flowish-content-security-policy',
      transformIndexHtml(html) {
        return html.replace('__FLOWISH_CSP__', command === 'serve' ? developmentCsp : productionCsp)
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'Flowish',
        short_name: 'Flowish',
        description: '本地优先的个人计划工具',
        lang: 'zh-CN',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ecefeb',
        theme_color: '#f3ede2',
        categories: ['productivity'],
        icons: [
          {
            src: 'icons/app-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ['**/*.{html,js,css,woff,woff2}'],
        navigateFallback: 'index.html',
        skipWaiting: true,
      },
    }),
  ],
  base: isGitHubPagesBuild && repoName ? `/${repoName}/` : '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.config.*', '**/*.d.ts', 'src/test/'],
      thresholds: {
        statements: 65,
        branches: 58,
        functions: 59,
        lines: 69,
      },
    },
  },
}))
