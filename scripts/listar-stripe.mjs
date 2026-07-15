#!/usr/bin/env node
/**
 * Lista todos los productos y precios de tu cuenta de Stripe.
 * Uso: node scripts/listar-stripe.mjs
 *
 * Solo LEE (no crea ni cobra nada). Sirve para ver de un vistazo qué
 * price_id usar en productos.json y detectar productos duplicados.
 */
import Stripe from 'stripe';

try {
  process.loadEnvFile();
} catch {
  /* variables por entorno */
}

const clave = process.env.STRIPE_SECRET_KEY ?? '';
if (!clave.startsWith('sk_')) {
  console.error('❌ Falta STRIPE_SECRET_KEY en .env (sk_live_... o sk_test_...)');
  process.exit(1);
}
const stripe = new Stripe(clave);
const modo = clave.startsWith('sk_live_') ? 'LIVE (producción)' : 'TEST (pruebas)';

console.log(`\n🔎 Cuenta Stripe en modo ${modo}\n`);

const euro = (c, cur) => c == null ? '—' : `${(c / 100).toFixed(2)} ${cur.toUpperCase()}`;

const productos = [];
for await (const p of stripe.products.list({ active: true, limit: 100 })) {
  productos.push(p);
}

if (productos.length === 0) {
  console.log('No hay productos activos en este modo.');
  process.exit(0);
}

for (const producto of productos) {
  console.log(`📦 ${producto.name}`);
  console.log(`   product: ${producto.id}`);
  const precios = [];
  for await (const precio of stripe.prices.list({ product: producto.id, active: true, limit: 100 })) {
    precios.push(precio);
  }
  for (const precio of precios) {
    const tipo = precio.recurring ? 'RECURRENTE ⚠️' : 'pago único';
    const marca = precio.id === producto.default_price ? ' (default)' : '';
    console.log(`   → ${precio.id}${marca}  ·  ${euro(precio.unit_amount, precio.currency)}  ·  ${tipo}  ·  tax:${precio.tax_behavior}`);
  }
  console.log('');
}

// Detección de nombres duplicados
const porNombre = {};
for (const p of productos) (porNombre[p.name] ??= []).push(p.id);
const dups = Object.entries(porNombre).filter(([, ids]) => ids.length > 1);
if (dups.length) {
  console.log('⚠️  PRODUCTOS DUPLICADOS (mismo nombre, varios product_id):');
  for (const [nombre, ids] of dups) console.log(`   "${nombre}": ${ids.join(', ')} → archiva los que sobren`);
  console.log('');
}

console.log('Copia el price_ (pago único, importe correcto) de cada producto a src/data/productos.json.');
