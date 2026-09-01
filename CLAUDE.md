# CLAUDE.md — Leybrak POS

Contexto para agentes/IA y desarrolladores nuevos. Léelo antes de tocar el código.

## Qué es

**SaaS de Punto de Venta (POS) multi-negocio para Perú.** Leybrak (la empresa) cobra
una mensualidad a sus negocios cliente (restaurantes/bares). Cada negocio gestiona
ventas, mesas, cocina (KDS), inventario, delivery, CRM, carta QR, facturación electrónica
(SUNAT) y validación de pagos Yape/Plin. Moneda: **PEN**. Zona horaria: **America/Lima**.
Código en **español**.

## Arquitectura — 3 clientes, 1 backend

| Componente | Stack | Carpeta |
|---|---|---|
| **Backend** | Django 5.2 + DRF + Channels (Daphne/ASGI) + Redis + PostgreSQL | `core/` (config), `negocios/` (app) |
| **Web** | React 19 + Vite + Zustand + Tailwind | `pos-frontend/` |
| **Móvil** | React Native + TypeScript | `LeybrakApp/` |

> **División de responsabilidades:** la **web** es el producto completo (panel del dueño/ERP).
> La **app móvil** es el POS de bolsillo + el listener de notificaciones Yape/Plin (solo Android).
> No se busca paridad total: la config pesada (editor de planos, CRM, carta QR) vive solo en web.

## Backend — claves

- **Auth:** JWT en **cookies HttpOnly** (`negocios/authentication.py` → `CookieJWTAuthentication`).
  El token NO va en localStorage ni en el header. Contexto de empleado vía header
  `X-Empleado-Id` (validado server-side contra el negocio del JWT; ver `negocios/views/helpers.py`).
- **Multi-tenant:** las queries se filtran por `sede__negocio=request.user.negocio`.
  `request.user.negocio` es la relación OneToOne (Negocio.propietario).
- **WebSockets:** Channels. Grupos tipo `pagos_negocio_{id}`. Consumers en
  `negocios/consumers.py`, rutas en `negocios/routing.py`, auth WS en `negocios/middleware.py`.
- **Modelos** (`negocios/models.py`, ~1045 líneas): `PlanSaaS`, `Negocio` (feature flags `mod_*`),
  `Sede`, `Empleado`, `Orden`, `Pago`, `PagoSuscripcion`, `NotificacionPago`, etc.
- **Vistas** divididas en `negocios/views/` por dominio (orden, caja, empleado, pago_yape, etc.).

## Cobro de suscripción (MercadoPago) — implementado

Leybrak cobra la mensualidad a sus negocios. Modelo MVP: **link de pago por mes + webhook**
(Checkout Pro). El cobro recurrente con tarjeta (preapproval) está **fuera de alcance**, pero
el diseño lo permite enchufar después.

- **Paquete:** `negocios/billing/` (`base.py`, `mercadopago_provider.py`, `factory.py`).
  Usa `requests` (no el SDK). `get_provider()` para cambiar de pasarela.
- **Endpoints:**
  - `POST /api/negocio/suscripcion/generar-pago/` (auth) → crea preferencia, devuelve `init_point`.
  - `POST /api/mp/webhook/` (AllowAny, firma **HMAC** con `MP_WEBHOOK_SECRET`) → confirma el pago.
- **Frontend:** botón pagar + polling en `pos-frontend/src/features/ERP/Erp_TabPlan.jsx` y
  pantalla de bloqueo en `pos-frontend/src/App.jsx`.
- **Tests:** `negocios/test_billing.py` (11 tests, todos pasan).
- **Estado del flujo:** `estado_suscripcion` reporta `activo/prueba/vencido/bloqueado`.
  Vigencia = último `PagoSuscripcion` con `estado='pagado'` en los últimos 31 días.
  Un pago `'pagado'` dispara el signal `reactivar_negocio_al_pagar` (en `negocios/signals.py`).

## Facturación electrónica SUNAT (Nubefact) — implementado

El negocio emite **boletas/facturas** a SUNAT vía **Nubefact** (PSE/OSE). Es **opcional y
off-by-default**: en Perú muchos dueños no quieren declarar todo. El "Ticket Digital" (recibo
de consumo por WhatsApp, sin valor legal) es **otra cosa** y ya existía aparte.

- **Paquete:** `negocios/facturacion/` (`base.py` ABC + Error, `factory.py` `get_provider(negocio)`,
  `nubefact_provider.py`, `payload.py`). Usa `requests`. Header Nubefact:
  `Authorization: Token token="<TOKEN>"`.
- **3 modos** (`Negocio.facturacion_emision`): `desactivado` (el botón cobrar es normal),
  `opcional` (tras cobrar aparece la opción de emitir), `automatico` (al cobrar se emite solo).
- **Modelos** (mig. `0067`, `0068`): `Comprobante` y `SerieComprobante`
  (`siguiente_numero` con `select_for_update`). Config en `Negocio`: `facturacion_emision`,
  `facturacion_entorno`, `facturacion_ruta`/`facturacion_token` (EncryptedCharField),
  `facturacion_serie_boleta`/`facturacion_serie_factura`.
- **Endpoints:** `POST /api/ordenes/<id>/emitir-comprobante/`, `GET .../comprobante/`,
  `GET /api/comprobantes/`. Consultas RUC/DNI: `GET /api/negocios/consultar_ruc/<ruc>/` y
  `consultar_dni/<dni>/` (vía `APIS_NET_PE_TOKEN`).
- **Frontend web:** config en `Erp_TabFacturacion.jsx`, emisión en `ModalEmitirComprobante.jsx`
  (se dispara al **Finalizar** el cobro, no antes). **Móvil:** mismo flujo en
  `LeybrakApp/src/components/modals/ModalEmitirComprobante.jsx` + integración en `ModalCobro.jsx`.
- **Móvil — modo `automatico`:** al llegar a la pantalla de éxito, `ModalCobro.jsx` emite la
  boleta sola (sin DNI) vía `useEffect` + `autoEmitRef` (evita doble emisión); si la emisión falla
  (Nubefact/SUNAT caído) aparece "Finalizar sin comprobante" como escape. Sin esto, `automatico`
  se veía igual que `opcional`.
- **Tests:** `negocios/test_facturacion.py` (10 tests).
- **Reglas IGV (SUNAT):** los precios **incluyen** IGV 18%. El IGV se calcula `base × 0.18`
  (NO por resta), cada ítem lleva su `subtotal` (base sin IGV). El redondeo por línea genera
  diferencias de ~céntimos en el total (aceptado). `unidad_de_medida='NIU'`, fecha `dd-mm-aaaa`,
  usar `timezone.localdate()` (mandar fecha futura → SUNAT rechaza).
- **DEMO de Nubefact NO envía a SUNAT real** → `aceptada_por_sunat` vuelve `false` aunque todo
  salga bien; el provider lo trata como éxito si hay PDF y no hay `errors`.

## Bot de WhatsApp — personalización e historias (n8n)

El bot conversacional vive en **n8n** (`silvadata.me/n8n/...`): Evolution API manda los mensajes
al webhook de n8n y n8n arma el prompt del LLM consultando `GET /api/negocios/info_bot/?instancia=...`.

- **Personalidad configurable** (mig. `0069`): campos en `Negocio` → `bot_nombre`,
  `bot_personalidad`, `bot_emojis`, `bot_instrucciones`. `info_bot` los devuelve en el objeto
  `persona`; **n8n debe inyectarlos en el system prompt** (cambio manual de una vez en el workflow).
  UI: ERP → Asistente Virtual → tab **Comportamiento** → tarjeta "Personalización" (`Bot_Personalidad.jsx`).
- **Historias programadas** (mig. `0070`, modelo `HistoriaProgramada`): el dueño sube imagen +
  texto + fecha (tab **Marketing**, `Bot_Marketing.jsx`); un **cron de n8n** publica los estados:
  1. `GET /api/bot/historias-pendientes/` (header `X-Bot-Token` = `BOT_API_TOKEN` o fallback
     `EVO_GLOBAL_KEY`) → devuelve pendientes vencidas con `instancia`, `imagen` (URL absoluta) y `texto`.
  2. Por cada una: `POST {EVO_API_URL}/message/sendStatus/{instancia}` (Evolution API, header
     `apikey`) con `{type:'image', content:<imagen>, caption:<texto>, allContacts:true}`.
  3. `POST /api/bot/historias-marcar/` con `{id, resultado:'publicada'|'error', error?}`.
  Endpoints en `negocios/views/historia_views.py`. CRUD web: `GET/POST /api/historias/` (multipart)
  y `POST /api/historias/<id>/cancelar/`.

## Mejora de fotos de productos con IA — implementado

Botón **"Mejorar con IA"** en cada foto de plato para que se vea más apetitosa. **Dos modos**:
realce determinístico (Pillow, gratis) y generativo (Gemini, requiere key).

- **Endpoints** (`ProductoViewSet` en `negocios/views/menu_views.py`, se enrutan solos por el router):
  - `POST /api/productos/<id>/mejorar_imagen/` (`modo: realce|ia`) → devuelve un **preview base64
    sin guardar**. `realce` = `_realce_pillow` (autocontraste + color/contraste/brillo/nitidez).
    `ia` = `_mejorar_gemini` (REST `generateContent`, el prompt prohíbe agregar/quitar ingredientes).
  - `POST /api/productos/<id>/aplicar_imagen/` (`imagen_base64`) → guarda definitivo (borra la anterior).
- **Frontend web:** ERP → Carta QR → pestaña **"Fotos Platos"** (`DashboardCartaQR/VistaEditor.jsx`):
  botón "Mejorar con IA" + modal con comparación Antes/Después y confirmación ("Usar esta foto").
- **Config:** `GEMINI_API_KEY` (vacío → solo funciona el realce; el modo IA da error claro) y
  `GEMINI_IMAGE_MODEL` (default `gemini-2.5-flash-image-preview`, el "Nano Banana"). Pillow ya está
  instalado. **Solo en la web** (la config pesada de carta vive en web).

## Ticket/boleta por WhatsApp al cobrar — implementado

Al **finalizar** el cobro, el campo "Ticket Digital" (teléfono) ahora **envía el comprobante por
WhatsApp sin salir de la app**, en vez de abrir el chat. Móvil **y** web.

- **Arquitectura:** el backend NO llama a Evolution directo: **dispara un webhook de n8n**
  (`N8N_TICKET_WEBHOOK_URL`) y n8n hace el envío vía Evolution API.
- **Helper:** `negocios/whatsapp_ticket.py` → `enviar_ticket_whatsapp(orden, telefono, comprobante)`.
  Normaliza el teléfono (9 díg. → `51…`), resuelve la `whatsapp_instancia` de la sede, arma el
  payload y hace POST fire-and-forget (header `X-Bot-Token`). Si está vacío el webhook, se omite sin error.
- **Endpoint:** `POST /api/ordenes/<id>/enviar-ticket/` (`{telefono}`) en `facturacion_views.py`.
  **Decide solo** PDF vs texto: si la orden ya tiene `Comprobante` con `enlace_pdf` → manda el
  documento; si no → recibo de **texto** del consumo.
- **Frontend:** `ModalCobro.jsx` (web y móvil) llama `enviarTicketWhatsapp(ordenId, telefono)` una
  sola vez (`ticketEnviadoRef`): en cerrar/finalizar-sin-comprobante → texto; tras emitir boleta/
  factura → PDF.
- **Contrato del webhook (n8n):** recibe `{instancia, telefono, negocio, orden_id, tipo}` + (`tipo:
  documento` → `pdf_url, nombre_archivo, caption`) o (`tipo: texto` → `texto`). n8n: documento →
  `POST {EVO_API_URL}/message/sendMedia/{instancia}` (mediatype `document`); texto →
  `…/message/sendText/{instancia}`. **n8n debe wirearse a mano** (Webhook + switch por `tipo`).

## Delivery — app dedicada del repartidor — implementado

El repartidor (un `Empleado` con `Rol.puede_repartir=True`) entra con su **PIN** y la app lo lleva
a una **pantalla dedicada estilo Rappi/inDrive** (NO ve el ERP/POS). Ve los pedidos de delivery de
su sede, los toma, navega y avisa al cliente. **Sin tracking GPS en vivo** (eso sería Fase 2).

- **Modelo** (mig. `0078`): `Orden.repartidor` (FK Empleado), `Orden.estado_delivery`
  (`pendiente→asignado→en_camino→entregado`), `Rol.puede_repartir`. La orden ya tenía
  `direccion_entrega`, `latitud`, `longitud`, `costo_envio`, `tipo='delivery'`.
- **Ruteo:** `login_empleado_pin` devuelve `id` (¡antes faltaba → `X-Empleado-ID` iba `undefined`!)
  y `puede_repartir`. `App.tsx`: si `sesion.es_repartidor` → renderiza `RepartidorScreen` en vez de
  `AppNavigator`. El rol repartidor se marca en Django admin (modelo `Rol`).
- **Endpoints** (`negocios/views/delivery_views.py`, gate por `get_empleado_verificado` +
  `rol.puede_repartir`):
  - `GET /api/delivery/pedidos/` → disponibles + los que tomó él.
  - `POST .../tomar/` → se lo asigna; `POST .../estado/` (`en_camino|entregado`) → solo el asignado;
    al `entregado` la orden pasa a `completado`. Al `en_camino` **avisa solo al cliente** por WhatsApp.
  - `POST .../avisar/` (`mensaje`) → el repartidor manda un WhatsApp al cliente (mensajes preset).
- **WhatsApp:** reusa el webhook de n8n de tickets (`enviar_mensaje_whatsapp` en `whatsapp_ticket.py`,
  rama `tipo:'texto'`). **No requiere wiring n8n nuevo.** Llamadas de voz por WhatsApp NO se pueden
  (Evolution/Baileys no inicia llamadas); el botón "Llamar" usa `tel:` (llamada normal).
- **Móvil:** `screens/Delivery/RepartidorScreen.jsx` — header con nombre + Salir, **"Iniciar ruta"**
  (marca asignados→en_camino y abre Google Maps con todas las paradas como waypoints), por pedido:
  **Navegar** (elige Google Maps o Waze, estilo inDrive), **Llamar** (`tel:`), **WhatsApp** (mensajes
  preset → endpoint `avisar`), y Tomar/En camino/Entregado. Refresco cada 20s.
- **Tests:** `negocios/test_delivery.py` (6 tests). **Sin WebSocket aún** (polling).

### Gate de caja en el login por PIN
`login_empleado_pin` bloquea (403 `caja_cerrada`) a los empleados con PIN que **no pueden abrir
caja** (mesero, cocinero, **motorizado**) si **no hay sesión de caja abierta** en la sede — sin
sesión = local cerrado, no se trabaja. Los roles que SÍ pueden abrir caja (cajero/admin/dueño/
gerente/encargado, por nombre de rol) entran igual para poder abrirla. El **dueño** entra por el
ERP (sin PIN) y abre la caja desde el POS (`SalonScreen`, gate ya existente). El login móvil
muestra el badge real (🔴 CAJA CERRADA / 🟢 CAJA ABIERTA) consultando `sesiones_caja/estado_actual/`.
Tests: `negocios/test_login_caja.py`. La respuesta del login trae `caja_abierta`.

## CRM + puntos — siempre activos

Crear/actualizar el cliente y **acumular puntos** ocurre **SIEMPRE** en toda venta con teléfono
(POS y bot), sin importar `mod_clientes_activo` ni `puntos_activo`. El flag `puntos_activo` solo
controla que el **bot** mencione/permita **canjear** (no la acumulación).

- **Helper único** `acreditar_compra_cliente(orden)` en `negocios/views/orden_views.py`:
  idempotente vía `Orden.puntos_otorgados` (mig. `0077`), así no acredita dos veces aunque la
  orden pase por varias vías. Llamado en `cobrar_orden` (POS) y `perform_create` (bot).
- **Matcheo de cliente** unificado por los **últimos 9 dígitos** (`_buscar_o_crear_cliente` +
  `_normalizar_telefono`) — POS y bot comparten el mismo registro; antes el POS hacía
  `get_or_create` con match exacto y duplicaba clientes (puntos repartidos). Los duplicados
  **previos** en BD no se fusionan solos.

## ⚠️ Gotchas (errores que ya costaron tiempo)

0. **Web — `setConfiguracionGlobal` HACE MERGE, no replace** (`usePosStore.js`). Hay varios
   setters parciales (`useTerminalData`, `useMesasData`, `useErpDashboard`, `View_Kds`) que
   comparten `configuracionGlobal`. Si replacearan, el del ERP (que no traía `facturacion_emision`)
   borraba ese campo y el POS se comportaba como `desactivado` (no salían los botones de boleta).
   Por eso el setter hace `{...state, ...nueva}`. Al agregar un setter, incluí los campos que
   necesitás o confiá en el merge — pero NO vuelvas a poner replace.
1. **`PagoSuscripcion.estado` canónico es `'pagado'`** — NO `'confirmado'`. El `'confirmado'`
   pertenece al modelo `Pago` (pagos del POS) y es correcto ahí; no lo toques.
2. **HTTPS detrás de Cloudflare/NPM:** el TLS termina en el proxy; el backend recibe HTTP.
   Para activar `HTTPS_ENABLED=True` sin bucle de redirección se necesitan **las 3**:
   - `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` en `core/settings.py`.
   - `nginx.conf` reenviando `X-Forwarded-Proto: https` (NO `$scheme`, que vale `http`).
   - `SECURE_REDIRECT_EXEMPT = [r'^api/health/?$']` — si no, el healthcheck del deploy
     (HTTP plano a `/api/health/`) devuelve 301 y **el deploy falla + hace rollback**.
3. **El webhook devuelve 200 ante pago inexistente** (404 en MP) para que MercadoPago no
   reintente infinitamente. Firma inválida → 403. Error transitorio de la API MP → 502 (reintenta).
4. **Versión de la app móvil: hay que subir 3 lugares en +1**, si no se desincroniza y la
   actualización forzada entra en **bucle infinito** (instalas y vuelve a pedir update):
   - `LeybrakApp/android/app/build.gradle` → `versionCode` y `versionName`.
   - `LeybrakApp/src/config/version.js` → `APP_VERSION_CODE` y `APP_VERSION_NAME`.
   El gate compara la **constante JS `APP_VERSION_CODE`** (no el versionCode nativo) contra
   `VersionApp.version_code_minima`. Si la constante quedó vieja, ni el APK nuevo rompe el bucle.
5. **Cloudflare cachea el APK** (`/media/leybrak.apk`). Tras subir un APK nuevo con el mismo
   nombre, si no purgas la caché Cloudflare sigue sirviendo el viejo (`cf-cache-status: HIT`) y
   el bucle de update continúa. **Solución a prueba de balas:** subir con nombre versionado
   (`leybrak-1.0.2.apk`) y apuntar `VersionApp.apk_url` ahí → URL nueva = cache miss, sin purgar.
6. **Capacidad del VPS (4GB/3vCPU) — medida con load test (k6), no adivinada:** con la config
   original (Postgres `max_connections=100` default + Daphne como un solo proceso), el sistema
   se caía a los ~65 usuarios concurrentes con `FATAL: sorry, too many clients already` — **no
   era un problema de RAM** (nunca pasó de ~430MB de 4GB). Con `max_connections=300` en `db` y
   `backend` corriendo `uvicorn --workers 3` (ver `docker-compose.yml`), el mismo droplet sostiene
   ~150-250 usuarios concurrentes con buena latencia y hasta 400 sin errores (más lento, ~5s p95).
   A esa carga el cuello de botella pasa a ser CPU (~2.8 de 3 vCPU en uso), no RAM (~1.5GB de 4GB).
   Si se necesita más, el siguiente paso es PgBouncer (pooling) antes que un VPS más grande.
   El bot de WhatsApp (Evolution API) es aparte y va por su propio presupuesto de RAM: en reposo
   (0 instancias) consume ~211MB fijos apenas se prende. Una instancia sin parear (esperando el
   código de vinculación) casi no pesa (~3MB) — pero eso NO es el costo real. Medido parenado un
   número real: una instancia CONECTADA y sincronizada (con `syncFullHistory=false`, que ya viene
   por default) se estabiliza en ~200MB adicionales. Con eso, un droplet de 4GB da para ~9-10
   negocios con bot activo simultáneo (dejando margen para el core + picos) antes de necesitar
   separar Evolution API a otro servidor — que sigue siendo lo recomendado si el bot es una feature
   central del producto, no solo opcional.
   Rig reusable en `loadtest/` (`docker-compose.loadtest.yml` + `loadtest.js` para el core con k6;
   `docker-compose.evotest.yml` para medir el costo de Evolution API parenado un número real).

## Deploy

- **Docker Compose:** servicios `db` (postgres), `redis`, `backend` (uvicorn --workers 3, :8000),
  `frontend` (nginx: sirve React + proxya `/api`,`/ws`,`/admin` al backend), `evolution-api` (WhatsApp).
- **Proxy externo:** Nginx Proxy Manager (NPM) + Cloudflare. `pos.leybrak.com` → contenedor `pos_frontend`.
  El backend queda público vía `pos.leybrak.com/api/...` (no hay subdominio aparte).
- **CI/CD:** `.github/workflows/deploy.yml` dispara en **push a `V2-Estable-Cloud`**, hace SSH al
  servidor, `git reset --hard`, build, `docker compose up -d`, `migrate`, healthcheck `/api/health/`,
  con **rollback automático** si el healthcheck falla.
- **Secretos:** `.env` en el servidor (está en `.gitignore`, NO se versiona).

## Release de la app móvil (APK + actualización forzada)

La app es **APK directo** (no Play Store). Al abrir consulta `GET /api/app/version/`; si
`forzar=True` y `APP_VERSION_CODE < version_code_minima`, muestra `PantallaActualizacion` (bloquea
todo) y descarga/instala el APK desde `apk_url`. Config editable en **Django admin → Versión de la
App** (modelo `VersionApp`, una fila por `plataforma='android'`).

**Build del APK firmado (Windows):** por el límite de 260 chars hay un **junction `C:\LB` →
`LeybrakApp/`**. Firma con `leybrak-release.keystore` (alias `leybrak`); credenciales en
`LeybrakApp/android/keystore.properties`. ⚠️ **La contraseña del keystore es irreemplazable**:
perderla = no poder firmar updates nunca más (debe estar respaldada por el dueño).

```powershell
# 1. Subir versión en build.gradle Y src/config/version.js (ver Gotcha #4)
# 2. Compilar (genera app/build/outputs/apk/release/app-release.apk, ~62 MB)
& C:\LB\android\gradlew.bat -p C:\LB\android assembleRelease --no-daemon
# 3. Subir al servidor (nombre versionado para evitar caché — ver Gotcha #5)
scp ...\app-release.apk USUARIO@HOST:~/leybrak-1.0.2.apk          # desde la PC
ssh USUARIO@HOST 'cd leybrakPOS && sudo docker compose cp ~/leybrak-1.0.2.apk backend:/app/media/leybrak-1.0.2.apk'
# 4. En el admin: version_code_minima, version_name_ultima, apk_url, activa ✅
```

`/media/` lo sirve nginx desde el volumen `media_volume` (compartido entre `backend:/app/media`
y `frontend:/usr/share/nginx/html/media`). El dir del repo en el servidor es `~/leybrakPOS`.
Verificar versión del APK local: `aapt dump badging <apk> | findstr versionCode`.

## Variables de entorno relevantes (`.env`)

```
SECRET_KEY, FIELD_ENCRYPTION_KEY, DATABASE_URL, REDIS_URL
ALLOWED_HOSTS, CORS_EXTRA_ORIGINS, HTTPS_ENABLED
# MercadoPago (cobro de suscripción)
MP_ACCESS_TOKEN     # token de la cuenta Leybrak (TEST-... sandbox / APP_USR-... prod)
MP_WEBHOOK_SECRET   # secret de firma del webhook (panel de MP)
MP_SANDBOX          # True mientras se prueba
BACKEND_URL=https://pos.leybrak.com
FRONTEND_URL=https://pos.leybrak.com
# Facturación electrónica (Nubefact) — credenciales DEMO por defecto
NUBEFACT_DEMO_RUTA   # URL de la cuenta Nubefact (demo o prod)
NUBEFACT_DEMO_TOKEN  # token Nubefact (si el negocio no tiene los suyos en BD)
# WhatsApp / SUNAT (consultas RUC/DNI vía decolecta/apis.net.pe)
EVO_API_URL, EVO_GLOBAL_KEY, APIS_NET_PE_TOKEN
# Ticket/boleta por WhatsApp al cobrar (backend → webhook n8n → Evolution)
N8N_TICKET_WEBHOOK_URL   # vacío → el envío se omite sin error
# Mejorar fotos de productos con IA (opcional; vacío → solo realce Pillow)
GEMINI_API_KEY
GEMINI_IMAGE_MODEL       # default: gemini-2.5-flash-image-preview
```

## Comandos

```bash
# Backend (usar el python del venv en Windows: venv/Scripts/python.exe)
python manage.py check
python manage.py migrate
python manage.py test negocios.test_billing      # suite del cobro
python manage.py test negocios.test_facturacion  # suite de facturación SUNAT
python manage.py makemigrations negocios

# Frontend web
cd pos-frontend && npm run dev                    # desarrollo
cd pos-frontend && npx vite build                 # build de producción

# App móvil
cd LeybrakApp && npm run android
```

## Convenciones

- Código, modelos, comentarios y UI en **español**.
- Las vistas externas (webhooks, carta pública) usan `@permission_classes([AllowAny])` y se
  autentican por token/firma, no por JWT.
- Al añadir un endpoint, regístralo en `negocios/urls.py` (router DRF o `path()` función).
- Hay tests reales para el cobro (`test_billing.py`) y la facturación (`test_facturacion.py`);
  el resto se prueba con los `.txt` en `TC/`.

## Deuda técnica conocida

- Sin tests automatizados fuera de cobro y facturación (caja, órdenes, etc.).
- `negocios/views_backup.py` (~1700 líneas) es código muerto, se puede borrar.
- `APP_VERSION_CODE` es una constante manual (`src/config/version.js`); idealmente leer el
  versionCode nativo con `react-native-device-info` para no desincronizar (ver Gotcha #4).
- Facturación: el redondeo de IGV por línea deja diferencias de céntimos. Las órdenes con
  **descuento** (p.ej. canje de puntos) ahora SÍ se facturan — el descuento se prorratea entre
  las líneas de producto; **delivery y recargo** van como líneas de servicio gravadas
  (`calcular_montos` en `facturacion/payload.py`). Las líneas siempre suman el total.
- Logging con `print()` en consumers/middleware en vez de `logging`.
