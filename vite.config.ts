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
          // Forma funcion, no objeto: la forma objeto dejaba react-vendor VACIO (1 byte)
          // y React quedaba adentro de charts -> el entry importaba charts estaticamente
          // y cada arranque bajaba 407 KB de Recharts sin usarlos (medido 2026-08-29).
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](recharts|victory-vendor|d3-[^\\/]+|react-smooth|recharts-scale)[\\/]/.test(id)) {
              return 'charts';
            }
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
              return 'react-vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            return undefined;
          },
        },
      },
    },
  };
});
