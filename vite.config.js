import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          exif: ['exifr']
        }
      }
    }
  },
  define: {
    // Fix for aws-sdk in browser
    'global': 'globalThis',
    'process.env': {}
  },
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
    }
  }
});
