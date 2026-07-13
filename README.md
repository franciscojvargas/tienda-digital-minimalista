# 🛍️ Tienda Digital Minimalista

**Plantilla lista para vender productos digitales en minutos.** Sin base de datos, sin registro de usuarios, sin mensualidades de plataformas. Tú pones los productos y las claves; la plantilla hace el resto.

- ⚡ **Ultra rápida** — páginas estáticas servidas desde CDN, ~20 KB por página, cero JavaScript pesado.
- 🔒 **Segura por diseño** — la tarjeta solo la ve Stripe; no hay base de datos que hackear.
- 💸 **Coste ~0 €** — capa gratuita de Vercel + Resend. Solo pagas la comisión de Stripe por venta.
- 📦 **Entrega automática** — el comprador recibe su link de descarga por email al pagar.
- 🔧 **Mantenimiento casi nulo** — añadir un producto = editar un JSON. Nada más.

**Stack:** Astro 5 · Tailwind 4 · Stripe Checkout · Resend · Vercel (o Netlify/Cloudflare).

---

## 🚀 Puesta en marcha (15 minutos)

### Paso 1 — Instalar

```bash
npm install
cp .env.example .env
```

### Paso 2 — Stripe (cobros)

1. Crea una cuenta en [stripe.com](https://stripe.com) (gratis).
2. En [Dashboard → Products](https://dashboard.stripe.com/products), crea tus productos con su precio.
3. Copia el **price ID** de cada uno (empieza por `price_`) y pégalo en `src/data/productos.json`.
4. En [Developers → API keys](https://dashboard.stripe.com/apikeys), copia la **clave secreta** (`sk_test_...`) en tu `.env`.

### Paso 3 — Resend (emails)

1. Crea una cuenta en [resend.com](https://resend.com) (gratis: 3.000 emails/mes).
2. Copia tu **API key** (`re_...`) en el `.env`.

> Mientras no verifiques un dominio propio, los emails salen de `onboarding@resend.dev` y **solo llegan a tu propio correo** — perfecto para probar. Antes de vender de verdad: verifica tu dominio en Resend y descomenta `FROM_EMAIL` en el `.env`.

### Paso 4 — Probar en local

```bash
# Terminal 1
npm run dev                    # http://localhost:4321

# Terminal 2 (necesitas stripe CLI: https://stripe.com/docs/stripe-cli)
stripe listen --forward-to localhost:4321/api/stripe-webhook
# → copia el whsec_... que imprime en tu .env y reinicia npm run dev
```

Compra de prueba: tarjeta `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC.

### Paso 5 — Desplegar en Vercel

1. Sube el proyecto a GitHub y conéctalo en [vercel.com](https://vercel.com) (detecta Astro solo).
2. En **Project Settings → Environment Variables**, añade las variables de tu `.env`.
3. En Stripe, [Developers → Webhooks](https://dashboard.stripe.com/webhooks), crea un endpoint:
   - URL: `https://TU-DOMINIO/api/stripe-webhook`
   - Evento: `checkout.session.completed`
4. Copia el nuevo `whsec_...` de producción en las variables de Vercel y redespliega.

Listo. Estás vendiendo.

---

## 🎨 Personalizar (2 archivos, nada más)

| Quiero cambiar… | Archivo |
|---|---|
| Nombre de la tienda, email de soporte, titular, moneda | `src/config.mjs` |
| Productos: nombre, descripción, precio, link de descarga | `src/data/productos.json` |
| Colores / estilos | Clases Tailwind en `src/pages/index.astro` y `src/layouts/Layout.astro` |
| Textos de los emails | `src/lib/emails.js` |

### Añadir un producto

Añade un bloque a `src/data/productos.json` (y crea su precio en Stripe):

```json
{
  "id": "mi-nuevo-producto",
  "nombre": "Nombre visible",
  "descripcion": "Descripción corta y vendedora.",
  "precio": 15,
  "stripe_price_id": "price_XXXX",
  "url_descarga": "https://tu-hosting.com/archivo.pdf"
}
```

El catálogo se valida en cada build: si te equivocas en un campo, el build falla con un mensaje que te dice exactamente qué corregir — **imposible desplegar una tienda rota**.

### Entrega del producto (`url_descarga`)

- **Con `url_descarga`**: el email de confirmación incluye un botón "Descargar tu producto". Vale cualquier URL https: Dropbox, Google Drive, un bucket S3/R2, tu propio hosting…
- **Sin el campo**: el email dice que recibirá el acceso en breve — útil si entregas a mano (acceso a Notion, invitación a comunidad, etc.).

---

## 🧠 Cómo funciona

```
Comprador                    Vercel                         Stripe
   │  clic "Comprar"           │                              │
   ├──────────────────────────▶│ /api/create-checkout-session │
   │                           │  valida producto, genera     │
   │                           │  pedido CMD-XXXXXX ─────────▶│ crea sesión
   │◀──────────────────────────┴──────────────────────────────┤
   │         redirige a Stripe Checkout (tarjeta+email+tel)   │
   │──────────────────────────── paga ───────────────────────▶│
   │◀─────────── /gracias?pedido=CMD-XXXXXX ──────────────────┤
   │                           │◀──── webhook (firmado) ──────┤
   │                           │  verifica firma + pagado     │
   │      📧 email comprador ◀─┤─▶ 📧 alerta al admin         │
```

- El **número de pedido** se genera en el servidor, viaja en los metadatos de Stripe y es el mismo en la página de gracias, el email del comprador y la alerta del admin.
- Las páginas (`/` y `/gracias`) son **HTML estático en CDN**: navegar no consume funciones serverless. Solo pagas cómputo cuando alguien compra.

```
src/
├── config.mjs                  ← 🎨 tu marca (único archivo de config)
├── data/productos.json         ← 📦 tu catálogo
├── lib/
│   ├── productos.js            ← validación del catálogo (build-time)
│   └── emails.js               ← plantillas de email
├── layouts/Layout.astro
└── pages/
    ├── index.astro             ← catálogo (estático)
    ├── gracias.astro           ← post-pago (estático)
    └── api/
        ├── create-checkout-session.js   ← serverless
        └── stripe-webhook.js            ← serverless
```

---

## 🔒 Seguridad incluida

| Amenaza | Defensa |
|---|---|
| Robo de datos de tarjeta | Stripe procesa el pago al 100%; la tarjeta nunca toca tu servidor (PCI-DSS delegado) |
| Inyección SQL / ataque a BD | No hay base de datos |
| Manipulación de precios | El cliente solo envía un `id`; el precio lo fija el `price_id` del servidor |
| Webhooks falsos | Verificación criptográfica de firma (`constructEvent`) + solo se confirma con `payment_status: paid` |
| Spam al endpoint de pago | Rechazo por `Origin` ajeno + rate limit por IP (10/min) + límite de tamaño de petición |
| Clickjacking / XSS | CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS; datos del comprador escapados en emails |
| Claves filtradas en git | `.env` en `.gitignore`; variables validadas con `astro:env` |
| Eventos de webhook duplicados | Deduplicación por `event.id` (peor caso teórico: un email repetido — nunca doble cobro) |

## ⚡ Rendimiento y coste

- Portada y página de gracias: **1 petición HTTP** (CSS inline, fuentes de sistema, sin imágenes ni frameworks de cliente).
- **0 invocaciones serverless por navegar** — solo se ejecuta código al comprar (2 funciones: checkout y webhook).
- `maxDuration: 10` — techo de facturación por ejecución.
- En capa gratuita de Vercel: miles de ventas/mes sin pagar hosting.

---

## 📈 Escalar cuando crezcas

| Necesito… | Cómo |
|---|---|
| Más productos | Añádelos al JSON — el grid se adapta solo (1/2/3 columnas según pantalla) |
| Cupones de descuento | Añade `allow_promotion_codes: true` en `create-checkout-session.js` y crea los cupones en Stripe |
| Otra moneda | Crea los precios en Stripe en esa moneda y cambia `simboloMoneda` en `src/config.mjs` |
| Netlify / Cloudflare en vez de Vercel | Cambia el adapter en `astro.config.mjs` (`@astrojs/netlify` o `@astrojs/cloudflare`) |
| Facturas automáticas | En Stripe: activa `invoice_creation` en la sesión de checkout |
| Links de descarga que caducan | Sirve los archivos desde un bucket (S3/R2) con URLs firmadas y ponlas en un endpoint propio |
| Historial de pedidos | No necesitas DB: el Dashboard de Stripe ES tu historial (busca por `CMD-XXXXXX` gracias a `client_reference_id`) |

## 🆘 Problemas frecuentes

- **"Missing environment variable"** al arrancar → falta una clave en `.env` (el error dice cuál).
- **El build falla mencionando productos.json** → lee el mensaje: te dice el producto y el campo exacto a corregir.
- **No llegan los emails** → ¿verificaste tu dominio en Resend? Con `onboarding@resend.dev` solo te llegan a ti. Mira también los logs de la función en Vercel.
- **El webhook devuelve 400** → el `STRIPE_WEBHOOK_SECRET` no corresponde a ese endpoint (el de `stripe listen` local y el de producción son distintos).
- **Stripe rechaza el pago de prueba** → estás usando claves `sk_live_` con tarjeta de prueba (o al revés).
