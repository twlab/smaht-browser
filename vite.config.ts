import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/smaht-browser/',
  plugins: [react()],
});
