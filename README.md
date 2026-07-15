# 🛍️ Tienda Digital Minimalista

**Plantilla lista para vender productos digitales.** Sin base de datos, sin registro de usuarios, sin mensualidades de plataformas. Tú pones el producto y las claves; la plantilla hace el resto — incluida la entrega con **enlaces firmados que caducan** y **marca de agua con el email del comprador** en cada archivo.

- ⚡ **Ultra rápida** — páginas estáticas servidas desde CDN, CSS inline, cero JavaScript pesado.
- 🔒 **Segura por diseño** — la tarjeta solo la ve Stripe; no hay base de datos que hackear; los enlaces de descarga van firmados con HMAC y caducan solos.
- 🖋️ **Anti-piratería incorporada** — el ZIP se genera en cada descarga estampando el email del comprador y su nº de pedido en cada PDF, DOCX y XLSX. No existe una "copia limpia" que filtrar.
- 💸 **Coste ~0 €** — capa gratuita de Vercel + Resend. Solo pagas la comisión de Stripe por venta.
- 📦 **Entrega automática** — email con enlace de descarga personal al momento de pagar.
- 🎟️ **Cupones listos** — el campo de código promocional ya está activo en el checkout.

**Stack:** Astro 5 · Tailwind 4 · Stripe Checkout · Resend · Vercel (o Netlify/Cloudflare).

---

## 🚀 Puesta en marcha (20 minutos)

### Paso 1 — Instalar

```bash
npm install
cp .env.example .env
openssl rand -hex 32   # → pégalo como DOWNLOAD_SECRET en el .env
```

`DOWNLOAD_SECRET` firma los enlaces de descarga: genera uno propio y **no lo cambies después de vender** (los enlaces ya emitidos dejarían de funcionar; para reemitir uno usa `npm run reenviar`).

### Paso 2 — Stripe (cobros)

1. Crea una cuenta en [stripe.com](https://stripe.com) (gratis).
2. En [Dashboard → Products](https://dashboard.stripe.com/products), crea tu producto con su precio (**IVA incluido**: *tax behavior → inclusive*).
3. Copia el **price ID** (empieza por `price_`) en `src/data/productos.json`.
4. En [Developers → API keys](https://dashboard.stripe.com/apikeys), copia la **clave secreta** (`sk_test_...`) en tu `.env`.

> Stripe tiene dos modos separados, **Test** y **Live** (interruptor arriba a la derecha del Dashboard). Cada modo tiene sus propias claves, productos, price IDs y webhooks: un `price_` de test NO funciona con una clave live. Configura primero todo en test; antes de vender, repite producto + claves + webhook en live.

### Paso 3 — Resend (emails)

1. Crea una cuenta en [resend.com](https://resend.com) (gratis: 3.000 emails/mes).
2. Copia tu **API key** (`re_...`) en el `.env`.
3. Para vender de verdad: **verifica tu dominio** en Resend (Domains → Add Domain → añade los registros DNS que te da) y pon `FROM_EMAIL="Mi Tienda <pedidos@midominio.com>"` en el `.env`.

> Sin dominio verificado, los emails salen de `onboarding@resend.dev` y **solo llegan a tu propio correo** — suficiente para probar, inútil para vender.

### Paso 4 — Tu producto

1. Sustituye los archivos de ejemplo de `productos-fuente/build/pack/` por los tuyos (PDF, DOCX, XLSX y cualquier otro; las subcarpetas se conservan en el ZIP).
2. Edita `src/data/productos.json`: nombre, descripción, precio, `stripe_price_id` y la lista `incluye`.
3. Edita `src/config.mjs`: nombre de la tienda, email de soporte, titular y el bloque `legal`.
4. Edita los textos marcados con ✏️ en `src/pages/index.astro`.
5. En `astro.config.mjs`, cambia `SITIO` por tu URL pública real.
6. Sustituye `public/og.png` (1200×630) y `public/apple-touch-icon.png` (180×180) — los que trae son placeholders de color plano — y, si quieres, `public/favicon.svg`.

### Paso 5 — Probar en local

```bash
# Terminal 1
npm run dev                    # http://localhost:4321

# Terminal 2 (necesitas stripe CLI: https://stripe.com/docs/stripe-cli)
stripe listen --forward-to localhost:4321/api/stripe-webhook
# → copia el whsec_... que imprime en tu .env y reinicia npm run dev
```

Compra de prueba: tarjeta `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC. Deben llegarte 2 emails (confirmación con enlace + alerta de venta) y el ZIP descargado debe llevar tu email estampado en el pie de cada PDF.

### Paso 6 — Desplegar en Vercel

1. Sube el proyecto a GitHub y conéctalo en [vercel.com](https://vercel.com) (detecta Astro solo).
2. En **Project Settings → Environment Variables**, añade **TODAS** las variables del `.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` y `DOWNLOAD_SECRET` (el mismo valor que en local). ⚠️ Si falta una sola, **todos** los endpoints `/api` devuelven 500 (`EnvInvalidVariables` en los logs), aunque el resto estén bien.
3. En Stripe, [Developers → Webhooks](https://dashboard.stripe.com/webhooks), crea un endpoint:
   - URL: `https://TU-DOMINIO/api/stripe-webhook` — ⚠️ **con el subdominio exacto que sirve tu web**. Si tu web vive en `www.tudominio.com`, el webhook debe llevar el `www`: Stripe NO sigue redirecciones, y un apex que redirige a www responde `308` y el evento se pierde (no llega ningún email).
   - Evento: `checkout.session.completed`
4. Copia el nuevo `whsec_...` de producción en las variables de Vercel.
5. **Redeploy** — Vercel no aplica variables nuevas a un deploy ya construido.

Listo. Haz una compra real pequeña (o con cupón del 100 %, ver abajo) para verificar el circuito completo.

---

## 📦 Cómo se entrega el producto

Dos modos, por producto, en `productos.json`:

| Campo | Qué hace |
|---|---|
| `ruta_pack` (recomendado) | El webhook envía un **enlace firmado** (HMAC con `DOWNLOAD_SECRET`, caduca a los 7 días) a `/api/descargar`, que genera el ZIP al vuelo desde esa carpeta **estampando en cada PDF/DOCX/XLSX el email del comprador y su nº de pedido**. Sin URL fija que se pueda filtrar. |
| `url_descarga` | Enlace directo (Dropbox, S3, tu hosting…) enviado tal cual en el email. Simple, pero sin caducidad ni marca de agua. |

Usa uno u otro, no ambos. Enlace perdido o caducado:

```bash
npm run reenviar -- <producto-id> <numero-pedido> <email-comprador>
# necesita DOWNLOAD_SECRET en .env y SITIO_URL=https://tu-dominio.com
```

## 🎟️ Cupones (y cómo probar gratis el flujo completo)

El campo "código promocional" ya está activo en el checkout (`allow_promotion_codes`). Para probar el circuito entero en producción sin gastar:

1. Stripe (modo Live) → Product catalog → Coupons → **Create coupon**: 100 %, duración "Once".
2. En el cupón → **Create promotion code**: elige el código (p. ej. `PRUEBA`) y ⚠️ **Max redemptions: 1** — el código lo puede teclear cualquiera.
3. Compra con el código: total 0 €, Stripe no pide tarjeta, y el webhook dispara igual (`payment_status: paid`) → llega el email con la descarga.
4. **Desactiva el promotion code** al terminar.

---

## 🎨 Personalizar

| Quiero cambiar… | Archivo |
|---|---|
| Nombre, email de soporte, titular, moneda, datos legales | `src/config.mjs` |
| Producto: nombre, precio, price_id, qué incluye | `src/data/productos.json` |
| Archivos que se entregan | `productos-fuente/build/pack/` |
| Textos de la portada (los marcados con ✏️) | `src/pages/index.astro` |
| URL pública y dominios permitidos | `astro.config.mjs` → `SITIO` |
| Colores / tipografías | `src/styles/global.css` (tema `almagre`) |
| Textos de los emails | `src/lib/emails.js` |
| Textos legales | `src/pages/aviso-legal.astro`, `privacidad.astro`, `terminos.astro` |

El catálogo se valida en cada build: si te equivocas en un campo, el build falla diciéndote exactamente qué corregir — imposible desplegar una tienda rota.

---

## ⚖️ Vender legalmente desde España — paso a paso

> ⚠️ Resumen orientativo para autónomos, no asesoramiento jurídico ni fiscal.
> Confirma tu caso con un gestor **antes de la primera venta real**.

### Antes de vender (obligatorio)

1. **Alta en Hacienda** — modelo 036/037 (gratis, online) antes de la primera venta.
2. **Alta en RETA** (Seguridad Social) si la actividad es habitual (con tarifa plana, ~87 €/mes el primer año).
3. **Rellena el bloque `legal` de `src/config.mjs`** — las páginas `/aviso-legal`, `/privacidad` y `/terminos` se generan solas (art. 10 LSSI).
4. **Precios con IVA incluido** en `productos.json` y en Stripe (*tax behavior: inclusive*).

### Derecho de desistimiento (ya resuelto en el código)

Los productos digitales de entrega inmediata están exentos de los 14 días de devolución (art. 103.m LGDCU) si el comprador consiente expresamente. La plantilla lo cubre: el aviso de renuncia aparece junto al botón de pago en Stripe Checkout y queda registrado en la sesión. Para máxima solidez, pon la URL de tus términos en Stripe (*Settings → Business → Public details*) y activa `consentimientoTerminos: true` en `config.mjs`.

### IVA e impuestos

| Situación | Qué hacer |
|---|---|
| Vendes solo a España | IVA 21 % incluido. Modelos 303 (trimestral) y 130 (IRPF). |
| UE < 10.000 €/año | Puedes seguir aplicando IVA español. |
| UE > 10.000 €/año | Alta en OSS (modelo 369) + `stripeTax: true` en `config.mjs` (con Stripe Tax activo). |
| Facturas | `npm run ventas` → CSV mensual para tu gestor o software certificado (Verifactu). Esta plantilla no emite facturas a propósito: un Verifactu casero no se puede certificar. |

Sin cookies de seguimiento ni analítica no necesitas banner de cookies; solo se trata el email del comprador (Stripe y Resend como encargados), así que la superficie RGPD es mínima.

---

## ✅ Checklist de lanzamiento

`npm run comprobar` verifica claves, catálogo, datos legales y pack **contra las APIs reales** de Stripe y Resend, y te dice exactamente qué falta.

- [ ] Gestor: alta 036 + RETA antes de la primera venta real
- [ ] `src/config.mjs`: marca + bloque `legal` completos
- [ ] `productos.json`: price_id real (IVA incluido) y tus archivos en `productos-fuente/build/pack/`
- [ ] `.env`: las 4 claves (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `DOWNLOAD_SECRET`)
- [ ] `astro.config.mjs`: `SITIO` con tu dominio real
- [ ] Dominio verificado en Resend + `FROM_EMAIL`
- [ ] Textos ✏️ de `index.astro` + páginas legales revisadas
- [ ] `npm run comprobar` → todo ✅
- [ ] Compra de prueba local con `4242 4242 4242 4242` (¿llegan los 2 emails? ¿el ZIP va marcado?)
- [ ] Deploy en Vercel + TODAS las env vars + webhook de producción (URL exacta, con `www` si toca) + redeploy
- [ ] Claves `sk_live_` + compra real (o cupón 100 % de un solo uso)
- [ ] Cada mes/trimestre: `npm run ventas` → CSV al gestor

## 🛠️ Operativa diaria

```bash
npm run dev            # desarrollo local
npm run comprobar      # ¿está todo listo para vender?
npm run ventas         # CSV del mes para el gestor
npm run reenviar -- <producto-id> <pedido> <email>   # reemite un enlace de descarga
npm run stripe:listar  # productos y price_id de tu cuenta de Stripe (solo lectura)
npm run build          # build de producción
```

---

## 🧠 Cómo funciona

```
Comprador                    Vercel                         Stripe
   │  clic "Comprar"           │                              │
   ├──────────────────────────▶│ /api/create-checkout-session │
   │                           │  valida producto, genera     │
   │                           │  pedido CMD-XXXXXX ─────────▶│ crea sesión
   │◀──────────────────────────┴──────────────────────────────┤
   │            redirige a Stripe Checkout (tarjeta+email)    │
   │──────────────────────────── paga ───────────────────────▶│
   │◀─────────── /gracias?pedido=CMD-XXXXXX ──────────────────┤
   │                           │◀──── webhook (firmado) ──────┤
   │                           │  verifica firma + pagado     │
   │  📧 email con enlace ◀────┤─▶ 📧 alerta al admin         │
   │                           │                              │
   │  clic en el enlace        │                              │
   ├──────────────────────────▶│ /api/descargar?token=...     │
   │                           │  verifica HMAC + caducidad   │
   │◀───── ZIP marcado ────────┤  estampa email en cada       │
   │       con su email        │  PDF/DOCX/XLSX y comprime    │
```

```
src/
├── config.mjs                  ← 🎨 tu marca (único archivo de config)
├── data/productos.json         ← 📦 tu catálogo
├── lib/
│   ├── productos.js            ← validación del catálogo (build-time)
│   ├── emails.js               ← plantillas de email
│   ├── descargas.js            ← tokens HMAC de descarga
│   ├── paquete.js              ← ZIP al vuelo con marca de agua
│   └── rateLimit.js            ← límite de peticiones por IP
├── layouts/Layout.astro
└── pages/
    ├── index.astro             ← portada (estática)
    ├── gracias.astro           ← post-pago (estática)
    ├── aviso-legal / privacidad / terminos
    └── api/
        ├── create-checkout-session.js   ← serverless
        ├── stripe-webhook.js            ← serverless
        └── descargar.js                 ← serverless
productos-fuente/build/pack/    ← 📁 los archivos que se entregan
```

## 🔒 Seguridad incluida

| Amenaza | Defensa |
|---|---|
| Robo de datos de tarjeta | Stripe procesa el pago al 100 %; la tarjeta nunca toca tu servidor |
| Inyección SQL / ataque a BD | No hay base de datos |
| Manipulación de precios | El cliente solo envía un `id`; el precio lo fija el `price_id` del servidor |
| Webhooks falsos | Verificación criptográfica de firma + solo se confirma con `payment_status: paid` |
| Descargas piratas | Enlace firmado HMAC que caduca a los 7 días + email del comprador estampado en cada archivo |
| Enlaces fabricados | Sin `DOWNLOAD_SECRET` es imposible generar un token válido; verificación en tiempo constante |
| Spam al endpoint de pago | Rechazo por `Origin` ajeno + rate limit por IP + límite de tamaño de petición |
| Clickjacking / XSS | CSP endurecida (`object-src 'none'`, `frame-src 'none'`, `upgrade-insecure-requests`), `X-Frame-Options: DENY`, `nosniff`, HSTS con `preload`, `Cross-Origin-Opener-Policy`; datos del comprador escapados en emails |
| Claves filtradas en git | `.env` en `.gitignore`; variables validadas con `astro:env` |
| Eventos duplicados | Deduplicación por `event.id` (peor caso: un email repetido — nunca doble cobro) |
| Contacto de seguridad | `/.well-known/security.txt` (RFC 9116) — pon tu email y renueva `Expires` una vez al año |

`npm run comprobar` avisa además de los placeholders peligrosos (dominio `example.com`
en `SITIO`, robots.txt y security.txt) antes de que lleguen a producción.

## 🆘 Problemas frecuentes

- **Todos los `/api` devuelven 500 y en los logs de Vercel pone `EnvInvalidVariables`** → falta una variable de entorno en Vercel (el log dice cuál). Añádela y **redeploy**: las variables nuevas no se aplican a deploys ya construidos.
- **El botón de comprar devuelve 403 en producción** → el dominio real no está en `allowedDomains`. Revisa que `SITIO` en `astro.config.mjs` lleve el subdominio exacto (¿`www`?): sin él, Astro ignora `X-Forwarded-Host` y el check anti-CSRF compara contra `localhost`.
- **El pago funciona pero no llega ningún email** → en Stripe → Webhooks, mira el último intento de entrega:
  - **`308`** → la URL del webhook redirige (apex → `www` o al revés). Stripe no sigue redirecciones: corrige la URL del endpoint al subdominio exacto y reenvía el evento con "Resend".
  - **`400` "firma inválida"** → el `STRIPE_WEBHOOK_SECRET` no corresponde a ese endpoint (test y live tienen secretos distintos; el de `stripe listen` local es otro más).
  - **`200` pero sin email** → el fallo es de Resend: mira los logs de la función en Vercel (dominio sin verificar es lo más común).
- **El build falla mencionando `productos.json`** → el mensaje te dice el producto y el campo exacto.
- **Stripe rechaza el pago de prueba** → claves `sk_live_` con tarjeta de prueba (o al revés).
- **El enlace de descarga da error** → caducado (7 días) o `DOWNLOAD_SECRET` distinto entre local y Vercel. Reemite con `npm run reenviar`.

## 📈 Escalar cuando crezcas

| Necesito… | Cómo |
|---|---|
| Más productos | Añádelos a `productos.json` y adapta `index.astro` (grid o páginas por producto) |
| Subir el precio | Price nuevo en Stripe + cambiar `precio` en el JSON (los price de Stripe son inmutables) |
| Otra moneda | Precios en Stripe en esa moneda + `simboloMoneda` en `config.mjs` |
| Netlify / Cloudflare | Cambia el adapter en `astro.config.mjs` (revisa el equivalente de `includeFiles`) |
| Facturas automáticas | En Stripe: activa `invoice_creation` en la sesión de checkout |
| Historial de pedidos | El Dashboard de Stripe ES tu historial (busca por `CMD-XXXXXX`) |
