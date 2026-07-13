// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Sitio estático por defecto: solo los endpoints de /api se ejecutan
// como funciones serverless (llevan `export const prerender = false`).
// Para Netlify o Cloudflare basta con cambiar el adapter.
export default defineConfig({
  output: 'static',
  adapter: vercel({
    // Techo de ejecución por función: ninguna operación legítima
    // (crear sesión, enviar 2 emails) tarda más de 10 s.
    maxDuration: 10,
  }),

  // Esquema de variables de entorno: si falta una clave obligatoria,
  // el error dice exactamente cuál — nada de fallos crípticos.
  env: {
    schema: {
      STRIPE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      STRIPE_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret' }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      ADMIN_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  build: {
    // CSS inline en el HTML: la página carga en una sola petición.
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
