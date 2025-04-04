import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Security headers
const securityHeaders = {
  'Content-Security-Policy': `
    default-src 'self';
    connect-src 'self' https://*.auth0.com https://*.us.auth0.com https://clarity-backend-production.up.railway.app wss://clarity-backend-production.up.railway.app;
    font-src 'self' data: https://*.auth0.com https://rsms.me;
    style-src 'self' 'unsafe-inline' https://*.auth0.com;
    script-src 'self' 'unsafe-inline' https://*.auth0.com https://cdn.auth0.com https://cdn.jsdelivr.net 'wasm-unsafe-eval';
    worker-src 'self' blob: https://cdn.jsdelivr.net;
    img-src 'self' data: https://*.auth0.com https://s.gravatar.com blob:;
    frame-src 'self' https://*.auth0.com https://*.us.auth0.com;
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
    block-all-mixed-content;
  `.replace(/\s+/g, ' ').trim(),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000';

  return {
    plugins: [react()],
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-router-dom', 
        '@auth0/auth0-react',
        'react-pdf',
        'pdfjs-dist'
      ],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      host: true,
      hmr: {
        overlay: false,
        timeout: 0,
        clientPort: 5174
      },
      watch: {
        usePolling: true,
        ignored: ['**/node_modules/**', '**/dist/**']
      },
      headers: securityHeaders,
      fs: {
        strict: false,
        allow: ['..']
      },
      cors: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          timeout: 120000,
          proxyTimeout: 120000,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
              proxyReq.setHeader('Connection', 'keep-alive');
              proxyReq.setTimeout(120000);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode);
            });
          }
        },
        '/static': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          timeout: 120000,
          proxyTimeout: 120000
        }
      }
    },
    define: {
      global: 'globalThis',
      __API_URL__: JSON.stringify(apiUrl),
      'process.env': {
        NODE_ENV: JSON.stringify(mode)
      }
    },
    css: {
      postcss: './postcss.config.cjs',
      modules: {
        localsConvention: 'camelCase'
      }
    },
    build: {
      target: 'esnext',
      minify: isProd,
      cssCodeSplit: true,
      sourcemap: !isProd,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            auth: ['@auth0/auth0-react'],
            pdfjs: ['pdfjs-dist']
          }
        }
      },
      assetsDir: 'assets',
      outDir: 'dist',
      commonjsOptions: {
        include: [/pdfjs-dist/]
      }
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    worker: {
      format: 'es',
      plugins: () => [react()]
    },
    publicDir: 'public',
  };
});
