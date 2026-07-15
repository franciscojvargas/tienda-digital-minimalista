import { join } from 'node:path';
import { DOWNLOAD_SECRET } from 'astro:env/server';
import { verificarTokenDescarga } from '../../lib/descargas.js';
import { construirPaqueteMarcado, existePack } from '../../lib/paquete.js';
import { buscarProducto } from '../../lib/productos.js';
import { crearLimitador } from '../../lib/rateLimit.js';

// Endpoint serverless: genera el ZIP bajo demanda, nunca se prerenderiza.
export const prerender = false;

// En local el cwd es la raíz del proyecto; en Vercel es /var/task, donde
// `includeFiles` (astro.config.mjs) deja el pack con la misma ruta relativa.
const RAIZ_PROYECTO = process.cwd();

// Más permisivo que el de checkout: un comprador legítimo puede
// reintentar la descarga varias veces (conexión cortada, quiere el
// enlace en otro dispositivo...). Sigue acotando el abuso por fuerza
// bruta contra el espacio de tokens.
const superaLimite = crearLimitador({ limite: 20, ventanaMs: 60_000 });

function respuestaError(status) {
  // Mensaje genérico siempre igual: token corrupto, firma inválida,
  // caducado o producto inexistente responden todos lo mismo, con el
  // mismo status y en el mismo tiempo aproximado — nada que le sirva a
  // quien esté probando tokens al azar para distinguir un caso de otro.
  return new Response('Enlace de descarga no válido o caducado. Escríbenos indicando tu número de pedido.', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function GET({ request, clientAddress }) {
  let ip = 'desconocida';
  try {
    ip = clientAddress;
  } catch {
    // clientAddress puede no estar disponible en algún runtime: seguimos.
  }
  if (superaLimite(ip)) {
    return new Response('Demasiadas peticiones, espera un minuto.', { status: 429 });
  }

  const token = new URL(request.url).searchParams.get('token');
  const datos = verificarTokenDescarga(token, DOWNLOAD_SECRET);
  if (!datos) return respuestaError(403);

  const producto = buscarProducto(datos.productoId);
  if (!producto?.ruta_pack) return respuestaError(404);

  const rutaPack = join(RAIZ_PROYECTO, producto.ruta_pack);
  if (!(await existePack(rutaPack))) {
    // Esto es un fallo de despliegue (el pack no se bundleó), no del
    // comprador: se registra pero se le responde igual de genérico.
    console.error(`[descargar] Falta la carpeta del pack en disco: ${rutaPack}`);
    return respuestaError(500);
  }

  try {
    const zip = await construirPaqueteMarcado({
      rutaPack,
      email: datos.email,
      numeroPedido: datos.numeroPedido,
    });

    return new Response(zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${producto.id}.zip"`,
        // Cada descarga es personal (email marcado en el momento): que
        // ningún proxy/CDN la guarde y la sirva a otra persona.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error(`[descargar] Error generando el paquete (pedido ${datos.numeroPedido}):`, error);
    return respuestaError(500);
  }
}
