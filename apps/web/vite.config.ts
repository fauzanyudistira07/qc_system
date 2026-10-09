import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 4180,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4100', '/health': 'http://127.0.0.1:4100' }
  }
});
