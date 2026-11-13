import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // En producción se eliminan los console.log/console.info/console.debug
  // (pueden exponer datos de clientes y ventas); se conservan warn y error.
  esbuild: mode === 'production' ? { pure: ['console.log', 'console.info', 'console.debug'] } : undefined,
  base: mode === 'production' ? '/se7en/' : '/',
  server: {
    port: 5173,
    host: true,
    hmr: {
      port: 5173
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild', // Cambiar de terser a esbuild
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          ui: ['framer-motion', 'react-hook-form', 'react-hot-toast']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}));
