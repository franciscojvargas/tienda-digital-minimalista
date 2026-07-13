#!/usr/bin/env node
/**
 * Comprobador de configuración: `npm run comprobar`
 *
 * Revisa todo lo necesario para vender (claves, productos, datos legales)
 * y te dice exactamente qué falta. Si hay claves reales, verifica contra
 * las APIs de Stripe y Resend que funcionan de verdad.
 */
import { readFileSync, existsSync } from 'node:fs';

try {
  process.loadEnvFile();
} catch {
  /* sin .env: se reporta abajo */
}

let errores = 0;
let avisos = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const aviso = (msg) => { avisos++; console.log(`  ⚠️  ${msg}`); };
const fallo = (msg) => { errores++; console.log(`  ❌ ${msg}`); };

console.log('\n🔍 Comprobando configuración de la tienda…\n');

// ── 1. Variables de entorno ───────────────────────────────────────────
console.log('Variables de entorno (.env)');
if (!existsSync('.env')) {
  fallo('No existe el archivo .env — copia .env.example: cp .env.example .env');
}
const claveStripe = process.env.STRIPE_SECRET_KEY ?? '';
const claveWebhook = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const claveResend = process.env.RESEND_API_KEY ?? '';

if (!claveStripe.startsWith('sk_') || claveStripe.includes('xxxx')) {
  fallo('STRIPE_SECRET_KEY sin rellenar (debe empezar por sk_test_ o sk_live_)');
} else {
  ok(`STRIPE_SECRET_KEY presente (modo ${claveStripe.startsWith('sk_live_') ? 'PRODUCCIÓN' : 'pruebas'})`);
}
if (!claveWebhook.startsWith('whsec_') || claveWebhook.includes('xxxx')) {
  fallo('STRIPE_WEBHOOK_SECRET sin rellenar (lo da `stripe listen` en local o el Dashboard en producción)');
} else {
  ok('STRIPE_WEBHOOK_SECRET presente');
}
if (!claveResend.startsWith('re_') || claveResend.includes('xxxx')) {
  fallo('RESEND_API_KEY sin rellenar (resend.com → API Keys)');
} else {
  ok('RESEND_API_KEY presente');
}
if (!process.env.FROM_EMAIL) {
  aviso('FROM_EMAIL sin definir: los emails saldrán de onboarding@resend.dev (solo llegan a tu propio correo)');
}

// ── 2. Catálogo de productos ──────────────────────────────────────────
console.log('\nCatálogo (src/data/productos.json)');
let productos = [];
try {
  productos = JSON.parse(readFileSync('src/data/productos.json', 'utf8'));
  ok(`JSON válido con ${productos.length} producto(s)`);
} catch (e) {
  fallo(`productos.json ilegible: ${e.message}`);
}
for (const p of productos) {
  if (!p.stripe_price_id || p.stripe_price_id.includes('REEMPLAZAR')) {
    fallo(`"${p.nombre ?? p.id}": stripe_price_id es un placeholder — crea el precio en Stripe y copia el price_...`);
  }
  if (p.url_descarga?.includes('example.com')) {
    aviso(`"${p.nombre ?? p.id}": url_descarga apunta a example.com — pon la URL real de tu archivo (o quita el campo)`);
  }
}

// ── 3. Datos legales ──────────────────────────────────────────────────
console.log('\nDatos legales (src/config.mjs)');
const { TIENDA } = await import('../src/config.mjs');
if (TIENDA.legal.nombreLegal === 'Nombre Apellidos') {
  fallo('legal.nombreLegal sin rellenar — obligatorio para el aviso legal (art. 10 LSSI)');
} else {
  ok(`Titular legal: ${TIENDA.legal.nombreLegal}`);
}
if (TIENDA.legal.nif === '00000000X') {
  fallo('legal.nif sin rellenar');
} else {
  ok('NIF rellenado');
}
if (TIENDA.legal.direccion.startsWith('Calle Ejemplo')) {
  fallo('legal.direccion sin rellenar');
} else {
  ok('Dirección rellenada');
}
if (!TIENDA.legal.consentimientoTerminos) {
  aviso('consentimientoTerminos desactivado — actívalo tras configurar la URL de términos en Stripe (checkbox de renuncia al desistimiento más sólido)');
}

// ── 4. Verificación real contra Stripe ────────────────────────────────
if (claveStripe.startsWith('sk_') && !claveStripe.includes('xxxx')) {
  console.log('\nConexión con Stripe');
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(claveStripe);
  try {
    await stripe.balance.retrieve();
    ok('Clave de Stripe válida');
    for (const p of productos) {
      if (!p.stripe_price_id?.startsWith('price_') || p.stripe_price_id.includes('REEMPLAZAR')) continue;
      try {
        const precio = await stripe.prices.retrieve(p.stripe_price_id);
        if (!precio.active) {
          fallo(`"${p.nombre}": el precio ${p.stripe_price_id} existe pero está DESACTIVADO en Stripe`);
        } else if (precio.unit_amount !== Math.round(p.precio * 100)) {
          aviso(`"${p.nombre}": el JSON dice ${p.precio}€ pero Stripe cobrará ${(precio.unit_amount / 100).toFixed(2)} ${precio.currency.toUpperCase()} — revisa cuál es el bueno`);
        } else {
          ok(`"${p.nombre}": precio verificado en Stripe (${p.precio}€)`);
        }
      } catch {
        fallo(`"${p.nombre}": el precio ${p.stripe_price_id} NO existe en esta cuenta de Stripe (¿modo test/live equivocado?)`);
      }
    }
  } catch {
    fallo('La clave de Stripe no funciona (revisa que esté completa y del modo correcto)');
  }
}

// ── 5. Verificación real contra Resend ────────────────────────────────
if (claveResend.startsWith('re_') && !claveResend.includes('xxxx')) {
  console.log('\nConexión con Resend');
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${claveResend}` },
    });
    if (res.ok) {
      ok('Clave de Resend válida');
      const { data } = await res.json();
      const verificados = (data ?? []).filter((d) => d.status === 'verified');
      if (verificados.length === 0) {
        aviso('Sin dominio verificado en Resend: los emails solo te llegarán a ti (suficiente para probar)');
      } else {
        ok(`Dominio(s) verificado(s): ${verificados.map((d) => d.name).join(', ')}`);
      }
    } else {
      fallo(`La clave de Resend no funciona (HTTP ${res.status})`);
    }
  } catch {
    aviso('No se pudo conectar con Resend (¿sin internet?)');
  }
}

// ── Resumen ───────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────');
if (errores === 0 && avisos === 0) {
  console.log('🎉 Todo listo. A vender.');
} else if (errores === 0) {
  console.log(`✅ Puedes vender. ${avisos} aviso(s) que conviene revisar.`);
} else {
  console.log(`🛑 ${errores} problema(s) que arreglar antes de vender (y ${avisos} aviso(s)).`);
}
console.log('');
process.exit(errores > 0 ? 1 : 0);
