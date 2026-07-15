// @ts-check
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// ⚠️ CAMBIA ESTO: la URL pública de tu tienda, con el subdominio exacto
// que verá el comprador (si tu web vive en www, pon el www).
const SITIO = 'https://example.com';

// Sitio estático por defecto: solo los endpoints de /api se ejecutan
// como funciones serverless (llevan `export const prerender = false`).
// Para Netlify o Cloudflare basta con cambiar el adapter.

// El endpoint /api/descargar lee en tiempo de ejecución las fuentes del
// pack (productos-fuente/build/pack/**) para marcarlas con el email del
// comprador. `includeFiles` solo acepta rutas de archivo individuales
// (no carpetas), así que las listamos aquí. Si no usas packs firmados
// (solo `url_descarga`), puedes borrar la carpeta sin tocar nada más.
function listarArchivosRecursivo(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? listarArchivosRecursivo(ruta) : [ruta];
  });
}
const carpetaPack = join(process.cwd(), 'productos-fuente/build/pack');
const archivosDelPack = existsSync(carpetaPack)
  ? listarArchivosRecursivo(carpetaPack).map(
      (rutaAbsoluta) => `./${relative(process.cwd(), rutaAbsoluta).split('\\').join('/')}`,
    )
  : [];

// Dominios desde los que la web puede recibir peticiones. Sin esta
// lista, Astro ignora la cabecera X-Forwarded-Host del proxy de Vercel
// y reconstruye request.url con host "localhost": la comprobación
// anti-CSRF de /api/create-checkout-session devolvería 403 SIEMPRE en
// producción. Se derivan de SITIO (apex y www) más los previews de Vercel.
const hostSitio = new URL(SITIO).hostname;
const hostSinWww = hostSitio.replace(/^www\./, '');
const dominiosPermitidos = [
  { hostname: hostSinWww, protocol: 'https' },
  { hostname: `www.${hostSinWww}`, protocol: 'https' },
  { hostname: '**.vercel.app', protocol: 'https' },
];

export default defineConfig({
  site: SITIO,
  output: 'static',
  adapter: vercel({
    // Techo de ejecución por función: ninguna operación legítima
    // (crear sesión, enviar emails, marcar y comprimir el pack) tarda
    // más de 10 s.
    maxDuration: 10,
    includeFiles: archivosDelPack,
  }),

  security: {
    allowedDomains: dominiosPermitidos,
  },

  integrations: [
    // Sitemap para Google: solo las páginas indexables (las legales y la de
    // gracias llevan noindex, así que tampoco van en el sitemap).
    sitemap({
      filter: (pagina) =>
        !['/gracias', '/aviso-legal', '/privacidad', '/terminos'].some((ruta) =>
          pagina.includes(ruta),
        ),
    }),
  ],

  // Esquema de variables de entorno: si falta una clave obligatoria,
  // el error dice exactamente cuál — nada de fallos crípticos.
  // ⚠️ En Vercel: si falta CUALQUIERA de las obligatorias, TODAS las
  // rutas /api devuelven 500 con "EnvInvalidVariables" en los logs.
  env: {
    schema: {
      STRIPE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      STRIPE_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret' }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      // Firma los enlaces de descarga (HMAC): sin ella nadie puede
      // fabricar ni validar un token válido. Genera una con
      // `openssl rand -hex 32` — no la reutilices de otro proyecto.
      DOWNLOAD_SECRET: envField.string({ context: 'server', access: 'secret' }),
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
