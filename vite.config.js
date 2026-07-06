import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: necesario para GitHub Pages (usuario.github.io/nombre-repo/)
  base: './',
  build: {
    outDir: 'docs',
  },
  plugins: [react()],
})
