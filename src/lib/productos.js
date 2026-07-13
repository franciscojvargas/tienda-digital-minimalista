import productosRaw from '../data/productos.json';

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
  if (producto.url_descarga && !/^https:\/\//.test(producto.url_descarga)) {
    throw new Error(`${donde}: "url_descarga" debe ser una URL https:// (o elimina el campo si no lo usas).`);
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
