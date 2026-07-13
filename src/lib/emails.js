import { Resend } from 'resend';
import { RESEND_API_KEY, ADMIN_EMAIL, FROM_EMAIL } from 'astro:env/server';
import { TIENDA } from '../config.mjs';

const resend = new Resend(RESEND_API_KEY);

const emailAdmin = ADMIN_EMAIL || TIENDA.emailSoporte;
const remitente = FROM_EMAIL || `${TIENDA.nombre} <onboarding@resend.dev>`;

const estilosBase = `
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1c1917;
`;

/**
 * Escapa caracteres HTML en cualquier valor dinámico antes de
 * interpolarlo en las plantillas (email/teléfono los escribe el
 * comprador en Stripe; el resto, por higiene y a prueba de futuro).
 */
function esc(valor) {
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fila(etiqueta, valor) {
  return `
    <tr>
      <td style="padding: 8px 0; color: #78716c;">${etiqueta}</td>
      <td style="padding: 8px 0; text-align: right;"><strong>${valor}</strong></td>
    </tr>
  `;
}

/**
 * El SDK de Resend NO lanza excepción cuando falla: devuelve { error }.
 * Este wrapper convierte ese error en excepción para que el webhook
 * pueda detectarlo y dejarlo en los logs.
 */
async function enviar(opciones) {
  const { data, error } = await resend.emails.send(opciones);
  if (error) {
    throw new Error(`Resend (${error.name ?? 'error'}): ${error.message}`);
  }
  return data;
}

/**
 * Email de confirmación al comprador: producto, número de pedido,
 * botón de descarga (si el producto lo tiene) y soporte.
 */
export async function enviarEmailComprador({ emailComprador, numeroPedido, nombreProducto, importe, enlaceDescarga }) {
  const bloqueDescarga = enlaceDescarga
    ? `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${esc(enlaceDescarga)}"
           style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none;
                  padding: 14px 32px; border-radius: 10px; font-weight: 600;">
          Descargar tu producto
        </a>
      </div>
    `
    : `
      <p style="background: #f5f5f4; border-radius: 10px; padding: 14px 16px; font-size: 14px;">
        En breve recibirás el acceso a tu producto en este mismo correo.
      </p>
    `;

  return enviar({
    from: remitente,
    to: emailComprador,
    subject: `Confirmación de tu pedido ${numeroPedido}`,
    html: `
      <div style="${estilosBase}">
        <h1 style="font-size: 22px;">¡Gracias por tu compra! ✅</h1>
        <p>Tu pago se ha procesado correctamente. Estos son los datos de tu pedido:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          ${fila('Número de pedido', `#${esc(numeroPedido)}`)}
          ${fila('Producto', esc(nombreProducto))}
          ${fila('Importe', `${esc(importe)} €`)}
        </table>
        ${bloqueDescarga}
        <p style="font-size: 13px; color: #78716c; border-top: 1px solid #e7e5e4; padding-top: 16px;">
          ¿Necesitas ayuda? Escribe a
          <a href="mailto:${esc(TIENDA.emailSoporte)}">${esc(TIENDA.emailSoporte)}</a>
          indicando tu número de pedido <strong>#${esc(numeroPedido)}</strong>.
        </p>
      </div>
    `,
  });
}

/**
 * Email de alerta al administrador: datos del comprador,
 * producto vendido y número de pedido.
 */
export async function enviarEmailAdmin({ emailComprador, telefonoComprador, numeroPedido, nombreProducto, importe }) {
  return enviar({
    from: remitente,
    to: emailAdmin,
    subject: `💰 Nueva venta ${numeroPedido} — ${nombreProducto}`,
    html: `
      <div style="${estilosBase}">
        <h1 style="font-size: 22px;">Nueva venta 🎉</h1>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          ${fila('Pedido', `#${esc(numeroPedido)}`)}
          ${fila('Producto', esc(nombreProducto))}
          ${fila('Importe', `${esc(importe)} €`)}
          ${fila('Email del comprador', esc(emailComprador ?? 'No disponible'))}
          ${fila('Teléfono del comprador', telefonoComprador ? esc(telefonoComprador) : 'No facilitado')}
        </table>
      </div>
    `,
  });
}
