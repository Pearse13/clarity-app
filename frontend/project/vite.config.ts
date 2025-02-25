import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';

  // Security headers based on environment
  const securityHeaders = {
    'Cross-Origin-Embedder-Policy': isProd ? 'require-corp' : 'unsafe-none',
    'Cross-Origin-Opener-Policy': isProd ? 'same-origin' : 'unsafe-none',
    'Cross-Origin-Resource-Policy': isProd ? 'same-origin' : 'cross-origin',
    'Access-Control-Allow-Origin': isProd ? env.VITE_ALLOWED_ORIGINS : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Strict-Transport-Security': isProd ? 'max-age=31536000; includeSubDomains' : '',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': isProd 
      ? `default-src 'self' https://${env.VITE_AUTH0_DOMAIN}; script-src 'self' https://${env.VITE_AUTH0_DOMAIN} https://cdn.auth0.com; connect-src 'self' https://${env.VITE_AUTH0_DOMAIN} ${env.VITE_API_URL}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.auth0.com https://s.gravatar.com; font-src 'self' data:; frame-src 'self' https://${env.VITE_AUTH0_DOMAIN}; upgrade-insecure-requests;`
      : `default-src 'self' https://*.auth0.com https://${env.VITE_AUTH0_DOMAIN} http://localhost:* https://cdn.auth0.com https://s.gravatar.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.auth0.com https://cdn.auth0.com http://localhost:*; connect-src 'self' https://*.auth0.com https://${env.VITE_AUTH0_DOMAIN} ws://localhost:* wss://localhost:* http://localhost:*; style-src 'self' 'unsafe-inline' https://*.auth0.com; img-src 'self' data: https://*.auth0.com https://s.gravatar.com; font-src 'self' data: https://*.auth0.com; frame-src 'self' https://*.auth0.com https://${env.VITE_AUTH0_DOMAIN};`
  };

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
      include: ['react', 'react-dom', 'react-router-dom', '@auth0/auth0-react'],
      esbuildOptions: {
        target: 'esnext'
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
      headers: securityHeaders
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
            auth: ['@auth0/auth0-react']
          },
          input: 'src/main.tsx'
        }
      }
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    }
  };
});
