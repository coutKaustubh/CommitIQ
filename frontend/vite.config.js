import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken instead of silently moving to 5174,
    // which breaks backend CORS + the Supabase OAuth redirect allowlist.
    strictPort: true,
  },
})
