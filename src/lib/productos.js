import { existsSync } from 'node:fs';
import { join } from 'node:path';
// El atributo `with { type: 'json' }` es imprescindible para que los
// scripts de /scripts (Node puro) puedan importar este módulo; Vite
// también lo entiende, así que sirve para la web y para la CLI.
import productosRaw from '../data/productos.json' with { type: 'json' };

// En local (dev, build, scripts) el cwd es la raíz del proyecto; en las
// funciones de Vercel es /var/task, donde `includeFiles` deja el pack con
// la misma ruta relativa. No sirve import.meta.url: tras bundlear, este
// módulo vive en dist/server/chunks/ y apuntaría al sitio equivocado.
const RAIZ_PROYECTO = process.cwd();

// En Vercel (build y runtime) la carpeta fuente del pack no está en el
// árbol de la función hasta que `includeFiles` la copia, así que la
// comprobación de existencia solo tiene sentido en local. El endpoint de
// descarga ya comprueba en cada petición que el pack está en disco.
const VALIDAR_RUTAS_EN_DISCO = !process.env.VERCEL;

/**
 * Carga y valida el catálogo. Se ejecuta en build (portada) y en los
 * endpoints: si el JSON tiene un error, el build falla con un mensaje
 * claro en lugar de desplegar una tienda rota.
 */
function validarProducto(producto, indice) {
  const donde = `productos.json → producto #${indice + 1}`;

  for (const campo of ['id', 'nombre', 'descripcion', 'precio', 'stripe_price_id']) {
    if (producto[campo] === undefined || producto[campo] === '') {
      throw new Error(`${donde}: falta el campo obligatorio "${campo}".`);
    }
  }
  if (!/^[a-z0-9-]{1,64}$/.test(producto.id)) {
    throw new Error(`${donde}: el "id" solo puede llevar minúsculas, números y guiones (ej. "mi-producto").`);
  }
  if (typeof producto.precio !== 'number' || producto.precio <= 0) {
    throw new Error(`${donde}: "precio" debe ser un número mayor que 0.`);
  }
  if (!producto.stripe_price_id.startsWith('price_')) {
    throw new Error(`${donde}: "stripe_price_id" debe empezar por "price_" (cópialo del Dashboard de Stripe).`);
  }
  // "ruta_pack" es server-side only: nunca se expone al navegador. Apunta
  // a la carpeta con las fuentes del pack que /api/descargar lee, marca
  // con el email del comprador y comprime en el momento de la descarga.
  // Se valida como ruta relativa simple (sin "..", sin absolutas) porque
  // termina concatenada a una ruta de disco: cero margen para path traversal.
  if (producto.ruta_pack !== undefined) {
    if (typeof producto.ruta_pack !== 'string' || !/^[a-zA-Z0-9_\-./]+$/.test(producto.ruta_pack) || producto.ruta_pack.includes('..')) {
      throw new Error(`${donde}: "ruta_pack" debe ser una ruta relativa simple, sin "..".`);
    }
    if (VALIDAR_RUTAS_EN_DISCO && !existsSync(join(RAIZ_PROYECTO, producto.ruta_pack))) {
      throw new Error(`${donde}: "ruta_pack" apunta a "${producto.ruta_pack}", que no existe.`);
    }
  }
  // "url_descarga" es la alternativa simple a "ruta_pack": un enlace
  // directo (Dropbox, S3, tu hosting…) que se envía tal cual en el email,
  // sin token firmado ni marcado de archivos. Usa una u otra, no ambas.
  if (producto.url_descarga !== undefined) {
    if (typeof producto.url_descarga !== 'string' || !producto.url_descarga.startsWith('https://')) {
      throw new Error(`${donde}: "url_descarga" debe ser una URL https completa.`);
    }
    if (producto.ruta_pack !== undefined) {
      throw new Error(`${donde}: usa "ruta_pack" (pack firmado y marcado) O "url_descarga" (enlace directo), no ambas.`);
    }
  }
  if (producto.incluye !== undefined) {
    const esListaValida = Array.isArray(producto.incluye)
      && producto.incluye.length > 0
      && producto.incluye.every((linea) => typeof linea === 'string' && linea.trim() !== '');
    if (!esListaValida) {
      throw new Error(`${donde}: "incluye" debe ser una lista de textos no vacíos (o elimina el campo).`);
    }
  }
  return producto;
}

const ids = new Set();
export const productos = productosRaw.map((producto, indice) => {
  const validado = validarProducto(producto, indice);
  if (ids.has(validado.id)) {
    throw new Error(`productos.json: el id "${validado.id}" está repetido. Cada producto necesita un id único.`);
  }
  ids.add(validado.id);
  return validado;
});

export function buscarProducto(id) {
  return productos.find((p) => p.id === id);
}
