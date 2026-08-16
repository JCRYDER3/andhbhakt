import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;
// PORT is only required for the dev/preview server, not for production builds
const port = rawPort ? Number(rawPort) : 3100;

// BASE_PATH is required for dev server routing; default to '/' for production builds
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Each huge data file gets its own async chunk
          if (id.includes('cag-reports-hi.json'))  return 'data-cag-hi';
          if (id.includes('state-facts-hi'))        return 'data-sf-hi';
          if (id.includes('cag-catalogue.json'))    return 'data-cag-catalogue';
          if (id.includes('cag-reports.ts') || id.includes('cag-reports/'))
                                                    return 'data-cag';
          // Vendor splitting — ALL React-dependent packages must be co-located
          // with react-dom/scheduler to guarantee initialisation order.
          // Separate chunks cause "Cannot set properties of undefined" crashes.
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory'))
                                                    return 'vendor-charts';
            if (id.includes('i18next'))             return 'vendor-i18n';
            if (id.includes('@tanstack'))           return 'vendor-query';
            // Everything else in node_modules goes into vendor-react to ensure
            // React initialises before any library that depends on it
            return 'vendor-react';
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
