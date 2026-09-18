import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the game from a sub-path (/<repo>/), so the publish
  // workflow sets VITE_BASE. Locally it stays at the root.
  base: process.env.VITE_BASE ?? '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
