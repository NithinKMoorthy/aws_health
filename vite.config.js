import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bind to loopback only; this is a local mock.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174 },
  preview: { host: '127.0.0.1', port: 4174 },
});
