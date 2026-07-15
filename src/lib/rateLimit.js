/**
 * Rate limiting en memoria (best-effort, sin base de datos). Vive
 * mientras la función serverless esté "caliente". No es perfecto entre
 * instancias, pero corta en seco el abuso desde una misma IP sin añadir
 * infraestructura. Fallo inofensivo: si la instancia se recicla, solo
 * se reinicia el contador.
 */
export function crearLimitador({ limite, ventanaMs }) {
  const contadores = new Map();

  return function superaLimite(clave) {
    const ahora = Date.now();
    // Evita crecimiento sin límite de memoria en instancias muy longevas.
    if (contadores.size > 5_000) contadores.clear();

    const registro = contadores.get(clave);
    if (!registro || ahora > registro.reinicio) {
      contadores.set(clave, { cuenta: 1, reinicio: ahora + ventanaMs });
      return false;
    }
    registro.cuenta += 1;
    return registro.cuenta > limite;
  };
}
