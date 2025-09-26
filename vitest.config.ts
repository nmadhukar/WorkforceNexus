import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    setupFiles: ['tests/utils/setup.ts'],
    sequence: {
      hooks: 'stack',
    },
    typecheck: {
      tsconfig: './tsconfig.test.json'
    },
    coverage: {
      provider: 'v8',
      enabled: false, // Set to true when running coverage
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './test-results/coverage',
      include: [
        'server/**/*.ts',
        'server/services/**/*.ts',
        'server/middleware/**/*.ts',
        'client/src/**/*.{ts,tsx}',
        'shared/**/*.ts'
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/*.config.{ts,js}',
        '**/vite.config.*',
        '**/vitest.config.*',
        '**/dist/**',
        '**/node_modules/**',
        '**/.next/**',
        '**/coverage/**',
        '**/test-results/**',
        '**/*.d.ts',
        '**/index.ts',
        '**/main.tsx',
        '**/vite-env.d.ts',
        'client/src/components/ui/**', // Exclude UI components library
        'server/vite.ts', // Exclude vite server config
        'server/db.ts' // Exclude database config
      ],
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85
      },
      clean: true,
      all: true, // Include all files, not just tested ones
      skipFull: false,
      // Watermarks for HTML reporter
      watermarks: {
        statements: [85, 95],
        functions: [85, 95],
        branches: [85, 95],
        lines: [85, 95]
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});