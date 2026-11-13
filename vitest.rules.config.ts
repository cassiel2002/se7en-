import { defineConfig } from 'vitest/config';

// Pruebas de firestore.rules contra el emulador de Firestore.
// Ejecutar con: npm run test:rules
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
