import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,      // Exposes the project to your network
    port: 8080,      // Matches your Airtel Router Rule #1
    strictPort: true, 
    proxy: {
      '/api': {
        // Use the INTERNAL IP of your machine for the proxy target
        target: 'http://192.168.1.12:5000', 
        changeOrigin: true,
        secure: false
      }
    }
  }
});