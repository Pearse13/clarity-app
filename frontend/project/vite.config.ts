import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';

  // Security headers based on environment
  const securityHeaders = {
    'Cross-Origin-Embedder-Policy': isProd ? 'require-corp' : 'unsafe-none',
    'Cross-Origin-Opener-Policy': isProd ? 'same-origin' : 'unsafe-none',
    'Cross-Origin-Resource-Policy': isProd ? 'cross-origin' : 'cross-origin',
    'Access-Control-Allow-Origin': isProd ? env.VITE_ALLOWED_ORIGINS : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Strict-Transport-Security': isProd ? 'max-age=31536000; includeSubDomains' : '',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': isProd 
      ? `default-src 'self' https://${env.VITE_AUTH0_DOMAIN}; script-src 'self' https://${env.VITE_AUTH0_DOMAIN} https://cdn.auth0.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com blob: 'wasm-unsafe-eval' 'unsafe-eval'; worker-src 'self' blob: data: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'self' https://${env.VITE_AUTH0_DOMAIN} ${env.VITE_API_URL} blob: data: https://cdn.jsdelivr.net https://*.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.auth0.com https://s.gravatar.com blob:; font-src 'self' data:; frame-src 'self' https://${env.VITE_AUTH0_DOMAIN}; upgrade-insecure-requests;`
      : `default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https: blob: 'wasm-unsafe-eval'; worker-src 'self' blob: data: http: https:; connect-src 'self' http: https: ws: wss: blob: data:;`
  };

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
      include: [
        'react', 
        'react-dom', 
        'react-router-dom', 
        '@auth0/auth0-react'
      ]
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
          target: 'http://127.0.0.1:8000',
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
      'process.env': {
        NODE_ENV: '"development"'
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
            pdf: ['pdfjs-dist']
          },
          input: {
            main: resolve(__dirname, 'index.html')
          }
        }
      }
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    worker: {
      format: 'es',
      plugins: () => [react()]
    }
  };
});
