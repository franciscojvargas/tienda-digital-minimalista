import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from 'astro:env/server';
import { enviarEmailComprador, enviarEmailAdmin } from '../../lib/emails.js';
import { buscarProducto } from '../../lib/productos.js';

// Endpoint serverless: Stripe lo llama directamente, nunca el navegador.
export const prerender = false;

const stripe = new Stripe(STRIPE_SECRET_KEY);

// ── Idempotencia best-effort (sin base de datos) ──────────────────────
// Stripe puede reenviar un evento si tarda en recibir el 200. Este Set
// vive mientras la instancia esté caliente y absorbe los reintentos
// inmediatos, que son los habituales. Peor caso si la instancia se
// recicla: un email duplicado. Inofensivo — nunca hay doble cobro.
const eventosProcesados = new Set();

function ok() {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }) {
  const firma = request.headers.get('stripe-signature');
  if (!firma) {
    return new Response('Falta la cabecera stripe-signature', { status: 400 });
  }

  // La verificación de firma exige el cuerpo RAW, sin parsear:
  // cualquier petición que no venga firmada por Stripe se rechaza aquí.
  const cuerpoRaw = await request.text();

  let evento;
  try {
    evento = stripe.webhooks.constructEvent(cuerpoRaw, firma, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('[stripe-webhook] Firma inválida:', error.message);
    return new Response('Firma del webhook inválida', { status: 400 });
  }

  if (evento.type !== 'checkout.session.completed') {
    return ok();
  }

  if (eventosProcesados.has(evento.id)) {
    console.log(`[stripe-webhook] Evento ${evento.id} ya procesado, ignorado.`);
    return ok();
  }
  if (eventosProcesados.size > 5_000) eventosProcesados.clear();
  eventosProcesados.add(evento.id);

  const sesion = evento.data.object;

  // Solo enviamos emails si el cobro está confirmado. Con tarjeta el
  // pago es síncrono, pero este guard evita confirmar ventas no
  // cobradas si algún día se activa un método de pago asíncrono.
  if (sesion.payment_status !== 'paid') {
    console.warn(`[stripe-webhook] Sesión ${sesion.id} completada pero no pagada (${sesion.payment_status}). Emails omitidos.`);
    return ok();
  }

  const numeroPedido = sesion.metadata?.numero_pedido ?? 'DESCONOCIDO';
  const nombreProducto = sesion.metadata?.producto_nombre ?? 'Producto digital';
  const emailComprador = sesion.customer_details?.email;
  const telefonoComprador = sesion.customer_details?.phone;
  const importe = typeof sesion.amount_total === 'number'
    ? (sesion.amount_total / 100).toFixed(2)
    : '—';

  // Si el producto tiene url_descarga en productos.json, el email del
  // comprador incluirá el botón de descarga. Entrega automática sin DB.
  const producto = buscarProducto(sesion.metadata?.producto_id);
  const enlaceDescarga = producto?.url_descarga;

  console.log(`[stripe-webhook] Venta confirmada ${numeroPedido} (evento ${evento.id})`);

  // Ambos correos en paralelo. allSettled: si uno falla, el otro
  // se envía igualmente y el fallo queda registrado en los logs.
  const resultados = await Promise.allSettled([
    emailComprador
      ? enviarEmailComprador({ emailComprador, numeroPedido, nombreProducto, importe, enlaceDescarga })
      : Promise.reject(new Error('La sesión no incluye email del comprador')),
    enviarEmailAdmin({ emailComprador, telefonoComprador, numeroPedido, nombreProducto, importe }),
  ]);

  resultados.forEach((resultado, indice) => {
    if (resultado.status === 'rejected') {
      const destino = indice === 0 ? 'comprador' : 'admin';
      console.error(`[stripe-webhook] Error enviando email al ${destino} (pedido ${numeroPedido}):`, resultado.reason);
    }
  });

  // Respondemos 200 siempre que la firma sea válida para que Stripe
  // no reintente eventos ya procesados.
  return ok();
}
