import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    video: 'off',
  },
  webServer: [
    {
      command: 'npm run dev:server',
      port: 3001,
      reuseExistingServer: true,
      timeout: 20_000,
    },
    {
      command: 'npm run dev:client',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 20_000,
    },
  ],
})
