import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    server: {
      port: 3000,
      host: 'localhost',
      open: true,
    },
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '1.0.0'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    css: {
      postcss: {
        plugins: [
          tailwindcss({ config: path.resolve(__dirname, 'tailwind.config.js') }),
          autoprefixer(),
        ],
      },
    },
    build: {
      outDir: 'dist',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'supabase': ['@supabase/supabase-js'],
            'charts': ['recharts'],
          },
        },
      },
    },
  };
});
