#!/usr/bin/env node
/**
 * Exportador de ventas: `npm run ventas` (mes actual)
 *                       `npm run ventas -- --mes 2026-06`
 *
 * Descarga de Stripe todas las ventas pagadas del mes y genera un CSV
 * listo para tu gestor o para importar en tu software de facturación
 * certificado (Verifactu): Holded, Quipu, Billin, app de la AEAT…
 *
 * Stripe es la fuente de verdad de tus ventas — no necesitas base de
 * datos propia. La factura fiscal la emite tu software certificado a
 * partir de estos datos.
 */
import { writeFileSync } from 'node:fs';
import Stripe from 'stripe';

try {
  process.loadEnvFile();
} catch {
  /* variables por entorno */
}

const clave = process.env.STRIPE_SECRET_KEY ?? '';
if (!clave.startsWith('sk_') || clave.includes('xxxx')) {
  console.error('❌ Falta STRIPE_SECRET_KEY en .env');
  process.exit(1);
}
const stripe = new Stripe(clave);

// Mes a exportar: --mes AAAA-MM, por defecto el actual.
const indiceArg = process.argv.indexOf('--mes');
const mes = indiceArg > -1 ? process.argv[indiceArg + 1] : new Date().toISOString().slice(0, 7);
if (!/^\d{4}-\d{2}$/.test(mes ?? '')) {
  console.error('❌ Formato de mes inválido. Uso: npm run ventas -- --mes 2026-07');
  process.exit(1);
}
const [anio, numMes] = mes.split('-').map(Number);
const desde = Math.floor(Date.UTC(anio, numMes - 1, 1) / 1000);
const hasta = Math.floor(Date.UTC(anio, numMes, 1) / 1000);

// Formato español: separador ; y coma decimal (abre bien en Excel/gestor).
const euros = (centimos) => (centimos / 100).toFixed(2).replace('.', ',');
const campo = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;

console.log(`\n📥 Descargando ventas de ${mes} desde Stripe…`);

const filas = [];
let totalCentimos = 0;

try {
  for await (const sesion of stripe.checkout.sessions.list({
    created: { gte: desde, lt: hasta },
    limit: 100,
  })) {
    if (sesion.payment_status !== 'paid') continue;

    const fecha = new Date(sesion.created * 1000).toISOString().slice(0, 10);
    totalCentimos += sesion.amount_total ?? 0;
    filas.push([
      campo(fecha),
      campo(sesion.metadata?.numero_pedido ?? sesion.client_reference_id ?? ''),
      campo(sesion.metadata?.producto_nombre ?? ''),
      campo(euros(sesion.amount_total ?? 0)),
      campo(sesion.total_details?.amount_tax != null ? euros(sesion.total_details.amount_tax) : ''),
      campo((sesion.currency ?? 'eur').toUpperCase()),
      campo(sesion.customer_details?.email ?? ''),
      campo(sesion.customer_details?.address?.country ?? ''),
      campo(sesion.id),
    ].join(';'));
  }
} catch (error) {
  console.error(`\n❌ Stripe rechazó la petición: ${error.message}`);
  console.error('   Revisa que STRIPE_SECRET_KEY sea correcta y del modo adecuado (test/live).');
  process.exit(1);
}

if (filas.length === 0) {
  console.log(`\nSin ventas pagadas en ${mes}. Nada que exportar.`);
  process.exit(0);
}

const cabecera = [
  'fecha', 'pedido', 'producto', 'total_eur', 'impuestos_incluidos_eur',
  'moneda', 'email_comprador', 'pais_comprador', 'id_sesion_stripe',
].join(';');

const archivo = `ventas-${mes}.csv`;
// BOM para que Excel abra los acentos bien.
writeFileSync(archivo, '﻿' + cabecera + '\n' + filas.join('\n') + '\n');

console.log(`\n✅ ${filas.length} venta(s) — total ${euros(totalCentimos)} €`);
console.log(`📄 Generado: ${archivo}`);
console.log('   Envíaselo a tu gestor o impórtalo en tu software de facturación certificado.\n');
