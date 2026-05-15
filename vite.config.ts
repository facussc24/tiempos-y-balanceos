import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig(({ mode }) => {
  return {
    base: mode === 'production' ? '/tiempos-y-balanceos/' : '/',
    server: {
      port: 3000,
      host: 'localhost',
      open: true,
    },
    plugins: [react()],
    define: {
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '1.0.0'),
      // Build timestamp inyectado en build-time. Se usa como cache-bust en
      // recursos que el HTML carga via iframe (puesto-3d, 3d-bolt-generator).
      // Sin esto, GH Pages sirve max-age=600 y el browser cachea iframes hasta
      // 10 min, mostrando version vieja aun despues de Ctrl+Shift+R.
      '__BUILD_TIMESTAMP__': JSON.stringify(Date.now()),
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
