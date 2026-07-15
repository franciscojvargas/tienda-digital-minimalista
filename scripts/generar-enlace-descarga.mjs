#!/usr/bin/env node
/**
 * Reemite un enlace de descarga caducado o perdido: `npm run reenviar`
 * Uso: node scripts/generar-enlace-descarga.mjs <producto-id> <numero-pedido> <email>
 * Ej.: node scripts/generar-enlace-descarga.mjs pack-ejemplo CMD-4F7A2C compradora@example.com
 *
 * Solo necesita DOWNLOAD_SECRET (el mismo del .env de producción) y el
 * catálogo local — no hace falta acceso a Stripe ni a ninguna base de
 * datos: el token nuevo es tan válido como el original.
 */
import { buscarProducto } from '../src/lib/productos.js';
import { crearTokenDescarga } from '../src/lib/descargas.js';

try {
  process.loadEnvFile();
} catch {
  /* variables por entorno */
}

const [productoId, numeroPedido, email] = process.argv.slice(2);

if (!productoId || !numeroPedido || !email) {
  console.error('Uso: node scripts/generar-enlace-descarga.mjs <producto-id> <numero-pedido> <email>');
  process.exit(1);
}

const secreto = process.env.DOWNLOAD_SECRET ?? '';
if (secreto.length < 32) {
  console.error('❌ Falta DOWNLOAD_SECRET en .env (debe ser el mismo que usa producción).');
  process.exit(1);
}

const producto = buscarProducto(productoId);
if (!producto) {
  console.error(`❌ No existe el producto "${productoId}" en src/data/productos.json`);
  process.exit(1);
}

const token = crearTokenDescarga({ productoId, numeroPedido, email, secreto });
const dominio = process.env.SITIO_URL ?? 'https://example.com';
if (!process.env.SITIO_URL) {
  console.warn('⚠️  SITIO_URL no definida: usando https://example.com. Añade SITIO_URL=https://tu-dominio.com a tu .env.');
}

console.log(`\n✅ Enlace nuevo (válido 7 días) para ${email}, pedido ${numeroPedido}:\n`);
console.log(`${dominio}/api/descargar?token=${encodeURIComponent(token)}\n`);
