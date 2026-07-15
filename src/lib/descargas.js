import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Enlaces de descarga sin base de datos: el token ES el permiso.
 * Contiene {producto, pedido, email, caducidad} firmado con HMAC-SHA256
 * y una clave que solo conoce el servidor (DOWNLOAD_SECRET). Nadie puede
 * fabricar ni alterar un token sin esa clave — cambiar una coma del email
 * o del pedido invalida la firma. No hace falta guardar nada: verificar
 * es solo recalcular el HMAC y compararlo.
 */

const DURACION_DESCARGA_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function firmar(payloadBase64, secreto) {
  return base64url(createHmac('sha256', secreto).update(payloadBase64).digest());
}

/**
 * @param {{productoId: string, numeroPedido: string, email: string, secreto: string}} datos
 * @returns {string} token opaco para meter en la URL de descarga
 */
export function crearTokenDescarga({ productoId, numeroPedido, email, secreto }) {
  const payload = {
    p: productoId,
    o: numeroPedido,
    // El email es case-insensitive en la práctica: lo normalizamos para
    // que la marca de agua y la verificación usen siempre el mismo valor.
    e: email.trim().toLowerCase(),
    exp: Date.now() + DURACION_DESCARGA_MS,
  };
  const payloadBase64 = base64url(JSON.stringify(payload));
  const firma = firmar(payloadBase64, secreto);
  return `${payloadBase64}.${firma}`;
}

/**
 * Verifica firma y caducidad. Nunca lanza: en cualquier problema
 * (token corrupto, firma inválida, caducado) devuelve null, para que
 * el endpoint responda siempre con el mismo error genérico y no dé
 * pistas de qué falló exactamente (nada de "firma inválida" vs
 * "caducado" como oráculo para quien esté probando tokens al azar).
 *
 * @returns {{productoId: string, numeroPedido: string, email: string} | null}
 */
export function verificarTokenDescarga(token, secreto) {
  if (typeof token !== 'string' || token.length > 2_000) return null;

  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [payloadBase64, firmaRecibida] = partes;

  const firmaEsperada = firmar(payloadBase64, secreto);

  // Comparación en tiempo constante: evita que un atacante deduzca la
  // firma correcta byte a byte midiendo cuánto tarda en fallar la
  // comparación (timing attack). Longitudes distintas → no es válido,
  // sin comparar contenido.
  const bufRecibido = Buffer.from(firmaRecibida ?? '', 'utf8');
  const bufEsperado = Buffer.from(firmaEsperada, 'utf8');
  if (bufRecibido.length !== bufEsperado.length) return null;
  if (!timingSafeEqual(bufRecibido, bufEsperado)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.p !== 'string' || typeof payload.o !== 'string' || typeof payload.e !== 'string') {
    return null;
  }
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;

  return { productoId: payload.p, numeroPedido: payload.o, email: payload.e };
}
