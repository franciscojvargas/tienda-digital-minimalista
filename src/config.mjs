/**
 * ⚙️ CONFIGURACIÓN DE LA TIENDA
 *
 * Este es el ÚNICO archivo que necesitas tocar para personalizar la marca.
 * Los productos se editan en src/data/productos.json.
 */
export const TIENDA = {
  // Nombre visible en la cabecera, el título y los emails.
  nombre: 'tienda.digital',

  // Descripción para buscadores (SEO).
  descripcion: 'Productos digitales de calidad. Pago seguro con Stripe, entrega inmediata.',

  // Email de soporte que se muestra al comprador (web y emails).
  // El email que RECIBE las alertas de venta se configura en .env (ADMIN_EMAIL).
  emailSoporte: 'frvagu@gmail.com',

  // Símbolo de moneda mostrado en la web. La moneda real del cobro
  // la define el precio que crees en Stripe.
  simboloMoneda: '€',

  // Texto del reclamo principal de la portada.
  titular: 'Productos digitales, entrega inmediata',
  subtitular: 'Sin registro. Sin esperas. Pagas con tarjeta y recibes tu producto en el correo al instante.',

  // ── Datos legales (obligatorios para vender desde España) ──────────
  // Rellena estos campos y las páginas /aviso-legal, /privacidad y
  // /terminos se generan solas. Ver README → "Vender legalmente desde España".
  legal: {
    // Tu nombre y apellidos (autónomo) o razón social (SL).
    nombreLegal: 'Nombre Apellidos',
    nif: '00000000X',
    // Dirección fiscal completa.
    direccion: 'Calle Ejemplo 1, 28001 Madrid, España',

    // ── Interruptores de checkout (actívalos cuando toque) ───────────
    // true = checkbox obligatorio de aceptación de términos en Stripe.
    // ANTES de activarlo: pon la URL de tus términos en el Dashboard de
    // Stripe → Settings → Business → Public details → Terms of service.
    consentimientoTerminos: false,

    // true = Stripe calcula el IVA automáticamente según el país del
    // comprador (necesario si vendes >10.000 €/año a otros países UE).
    // ANTES de activarlo: activa Stripe Tax en el Dashboard y marca tus
    // precios como "IVA incluido" (tax behavior: inclusive).
    stripeTax: false,
  },
};
