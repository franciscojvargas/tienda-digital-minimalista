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
};
