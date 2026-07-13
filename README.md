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
| Datos legales (nombre, NIF, dirección) e interruptores fiscales | `src/config.mjs` → bloque `legal` |
| Productos: nombre, descripción, precio, link de descarga | `src/data/productos.json` |
| Colores / estilos | Clases Tailwind en `src/pages/index.astro` y `src/layouts/Layout.astro` |
| Textos de los emails | `src/lib/emails.js` |
| Textos legales (aviso legal, privacidad, términos) | `src/pages/aviso-legal.astro`, `privacidad.astro`, `terminos.astro` |

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

## ⚖️ Vender legalmente desde España — paso a paso

> ⚠️ Esto es un resumen orientativo para autónomos, no asesoramiento jurídico ni fiscal.
> Confirma tu caso con un gestor **antes de la primera venta real** — es una consulta barata
> que evita sanciones caras.

### Antes de vender (obligatorio)

1. **Alta en Hacienda** — modelo 036/037 (alta censal, gratis, online) antes de la primera venta.
2. **Alta en RETA** (Seguridad Social) si la actividad es habitual. Con tarifa plana,
   ~87 €/mes el primer año. Vender de forma continuada sin alta = riesgo de sanción + cuotas atrasadas.
3. **Rellena el bloque `legal` de `src/config.mjs`** (nombre, NIF, dirección) — las páginas
   `/aviso-legal`, `/privacidad` y `/terminos` se generan solas con tus datos y ya están
   enlazadas en el pie de página. Publicar la identidad del titular es obligatorio (art. 10 LSSI).
4. **Precios con IVA incluido**: en ventas a consumidores, el precio mostrado debe ser el
   final. Los precios que pongas en `productos.json` y en Stripe deben llevar el IVA dentro
   (en Stripe, crea los precios con *tax behavior: inclusive*).

### Derecho de desistimiento (ya resuelto en el código)

Los productos digitales de entrega inmediata están **exentos** de los 14 días de devolución
(art. 103.m LGDCU), pero solo si el comprador **consiente expresamente** la entrega inmediata
y la renuncia. La plantilla lo cubre en dos niveles:

- El aviso de renuncia aparece **junto al botón de pago** en Stripe Checkout (siempre activo)
  y queda registrado en la sesión como prueba.
- Para máxima solidez, activa el **checkbox obligatorio**: pon la URL de tus términos en
  Stripe (*Settings → Business → Public details → Terms of service*) y cambia
  `consentimientoTerminos: true` en `src/config.mjs`.

### IVA e impuestos (cuándo activar qué)

| Situación | Qué hacer |
|---|---|
| Vendes solo a España | IVA 21% incluido en el precio. Declaras con el modelo 303 (trimestral) y 130 (IRPF). Con un gestor, esto es rutina. |
| Vendes a otros países UE < 10.000 €/año | Puedes seguir aplicando IVA español. |
| Superas 10.000 €/año en UE | Debes cobrar el IVA del país del comprador: date de alta en **OSS** (ventanilla única, modelo 369) y activa `stripeTax: true` en `config.mjs` (con Stripe Tax activo en el Dashboard) — calcula el IVA correcto por país automáticamente. |
| Facturas | Ver la sección [Facturación y Verifactu](#-facturación-y-verifactu) — la plantilla incluye `npm run ventas` para dárselo hecho a tu gestor. |

### Resumen: quién hace qué

| Tarea | ¿Quién? |
|---|---|
| Alta 036 + RETA | Tú con tu gestor (una vez) |
| Datos legales en la web | Tú: rellenar `config.mjs` (2 minutos) |
| Renuncia al desistimiento | ✅ Ya en el código |
| Aviso legal / privacidad / términos | ✅ Ya generados (revísalos y ajústalos a tu caso) |
| IVA por país (si creces en UE) | Activar `stripeTax` + alta OSS con gestor |
| Facturas Verifactu | Gestor o software certificado |

**Ventaja de esta arquitectura**: sin cookies de seguimiento ni analítica no necesitas banner
de cookies, y al no almacenar tarjetas ni cuentas de usuario, tu superficie de riesgo RGPD es
mínima (solo email y teléfono, tratados por Stripe y Resend como encargados).

---

## 🧾 Facturación y Verifactu

**Lo claro primero**: desde julio de 2026 los autónomos deben emitir facturas con software
certificado (**Verifactu** — registros encadenados, QR y comunicación con la AEAT). Esta
plantilla **no emite facturas, y es a propósito**: un sistema Verifactu casero no se puede
certificar (exige registros encadenados inalterables — imposible sin base de datos) y una
factura no certificada te expone en vez de protegerte.

Lo que sí hace la plantilla es dejarte la facturación a **un comando de distancia**:

```bash
npm run ventas                    # ventas pagadas del mes actual → CSV
npm run ventas -- --mes 2026-06   # un mes concreto
```

Genera `ventas-AAAA-MM.csv` (formato español: `;` y coma decimal, abre directo en Excel) con
fecha, nº de pedido, producto, importe, impuestos, email, teléfono y país de cada venta,
sacado directamente de Stripe — que es tu registro de ventas real, sin base de datos propia.

Con ese CSV tienes dos caminos:

1. **Gestor** (recomendado para empezar): le envías el CSV cada mes/trimestre y él emite las
   facturas con su software certificado y presenta tus modelos (303, 130). Cero herramientas
   por tu parte.
2. **Software certificado propio**: importa el CSV (o conecta Stripe directamente) en
   Holded, Quipu, Billin o la aplicación gratuita de facturación de la AEAT, y emite ahí
   las facturas.

> Nota: los CSV contienen datos personales de compradores — ya están excluidos de git
> (`.gitignore`) y no debes compartirlos fuera de tu gestor/software de facturación.

---

## ✅ Checklist de lanzamiento (de cero a vender legal)

Ejecuta `npm run comprobar` en cualquier momento: revisa claves, productos, datos legales y
verifica **contra las APIs reales** de Stripe y Resend que todo funciona (precios existentes,
importes coincidentes, dominio de email verificado…). No te deja dudas de qué falta.

```bash
npm run comprobar
```

- [ ] **Gestor**: alta censal (036) + RETA antes de la primera venta real
- [ ] `src/config.mjs`: nombre de la tienda, email de soporte y bloque `legal` (nombre, NIF, dirección)
- [ ] `src/data/productos.json`: tus productos con sus `price_id` reales de Stripe (precios **IVA incluido**) y `url_descarga` reales
- [ ] `.env`: las 3 claves (Stripe secreta, webhook, Resend)
- [ ] Dominio verificado en Resend + `FROM_EMAIL` en `.env`
- [ ] Leer y ajustar `/aviso-legal`, `/privacidad` y `/terminos` (generados con tus datos)
- [ ] URL de términos en Stripe (*Settings → Business → Public details*) → `consentimientoTerminos: true`
- [ ] `npm run comprobar` → todo ✅
- [ ] Compra de prueba completa con tarjeta `4242 4242 4242 4242` (¿llegan los 2 emails?)
- [ ] Desplegar en Vercel + webhook de producción + variables de entorno
- [ ] Cambiar a claves `sk_live_` y hacer una compra real pequeña
- [ ] Cada mes/trimestre: `npm run ventas` → CSV al gestor

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
