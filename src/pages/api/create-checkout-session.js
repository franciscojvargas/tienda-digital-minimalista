import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { STRIPE_SECRET_KEY } from 'astro:env/server';
import { buscarProducto } from '../../lib/productos.js';

// Endpoint serverless: se ejecuta bajo demanda, nunca se prerenderiza.
export const prerender = false;

const stripe = new Stripe(STRIPE_SECRET_KEY);

// ── Rate limiting en memoria (best-effort, sin base de datos) ─────────
// Vive mientras la función serverless esté "caliente". No es perfecto
// entre instancias, pero corta en seco el abuso desde una misma IP
// sin añadir infraestructura. Fallo inofensivo: si se reinicia, solo
// se reinicia el contador.
const LIMITE_PETICIONES = 10; // por IP
const VENTANA_MS = 60_000; // por minuto
const contadores = new Map();

function superaLimite(ip) {
  const ahora = Date.now();
  // Evita crecimiento sin límite de memoria en instancias muy longevas.
  if (contadores.size > 5_000) contadores.clear();

  const registro = contadores.get(ip);
  if (!registro || ahora > registro.reinicio) {
    contadores.set(ip, { cuenta: 1, reinicio: ahora + VENTANA_MS });
    return false;
  }
  registro.cuenta += 1;
  return registro.cuenta > LIMITE_PETICIONES;
}

function respuestaJson(cuerpo, status) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Genera un número de pedido único y legible, ej. "CMD-4F7A2C".
 * Se guarda en los metadatos de la sesión de Stripe: es la única fuente
 * de verdad y la comparten la página de gracias y el webhook.
 */
function generarNumeroPedido() {
  const aleatorio = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `CMD-${aleatorio}`;
}

export async function POST({ request, clientAddress }) {
  const origen = new URL(request.url).origin;

  // Los navegadores siempre envían Origin en un POST fetch. Si viene de
  // otro dominio, lo rechazamos: evita que webs ajenas consuman
  // invocaciones serverless y creen sesiones de pago en nuestro nombre.
  const origenPeticion = request.headers.get('origin');
  if (origenPeticion && origenPeticion !== origen) {
    return respuestaJson({ error: 'Origen no permitido' }, 403);
  }

  // Solo aceptamos JSON pequeño: cualquier otra cosa es un cliente raro.
  const tipoContenido = request.headers.get('content-type') ?? '';
  if (!tipoContenido.includes('application/json')) {
    return respuestaJson({ error: 'Content-Type debe ser application/json' }, 415);
  }
  const longitud = Number(request.headers.get('content-length') ?? 0);
  if (longitud > 1_024) {
    return respuestaJson({ error: 'Petición demasiado grande' }, 413);
  }

  let ip = 'desconocida';
  try {
    ip = clientAddress;
  } catch {
    // clientAddress puede no estar disponible en algún runtime: seguimos.
  }
  if (superaLimite(ip)) {
    return respuestaJson({ error: 'Demasiadas peticiones, espera un minuto' }, 429);
  }

  let productoId;
  try {
    ({ productoId } = await request.json());
  } catch {
    return respuestaJson({ error: 'Cuerpo de la petición inválido' }, 400);
  }
  if (typeof productoId !== 'string' || productoId.length > 64) {
    return respuestaJson({ error: 'productoId inválido' }, 400);
  }

  // Validamos contra el catálogo local: el cliente solo envía un id,
  // el precio real siempre lo decide el price_id del servidor.
  const producto = buscarProducto(productoId);
  if (!producto) {
    return respuestaJson({ error: 'Producto no encontrado' }, 404);
  }

  const numeroPedido = generarNumeroPedido();

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: 'payment',

      // Solo tarjeta: pago síncrono garantizado. Así el evento
      // checkout.session.completed siempre llega ya cobrado.
      payment_method_types: ['card'],
      line_items: [{ price: producto.stripe_price_id, quantity: 1 }],

      // Solo pedimos email (automático en Checkout) y teléfono.
      // Producto digital: sin dirección de envío ni de facturación.
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      submit_type: 'pay',

      // Las sesiones abandonadas caducan a los 30 min (mínimo de Stripe)
      // en lugar de las 24 h por defecto.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,

      // Visible en el Dashboard de Stripe: permite buscar por pedido.
      client_reference_id: numeroPedido,

      // El webhook usará estos metadatos para los emails.
      metadata: {
        numero_pedido: numeroPedido,
        producto_id: producto.id,
        producto_nombre: producto.nombre,
      },

      success_url: `${origen}/gracias?pedido=${numeroPedido}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origen}/`,
    });

    return respuestaJson({ url: sesion.url }, 200);
  } catch (error) {
    console.error('[create-checkout-session]', error.message);
    return respuestaJson({ error: 'No se pudo crear la sesión de pago' }, 500);
  }
}
