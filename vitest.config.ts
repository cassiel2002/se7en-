import { defineConfig } from 'vitest/config';

// Pruebas unitarias: funciones puras y utilidades del navegador (jsdom).
// Las pruebas de reglas de Firestore usan vitest.rules.config.ts (requieren emulador).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
  },
});
