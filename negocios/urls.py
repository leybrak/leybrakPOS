from django.urls import path, include
from rest_framework.routers import DefaultRouter
from negocios.views.empleado_views import estado_bloqueo_pin
from negocios.views.marketing_views import (
    HappyHourDetalleView,
    HappyHourView,
    MarketingGlobalView,
    ComboPromocionalView,
    ComboPromocionalDetalleView,
    ReglaNegocioDetalleView,
    ReglaNegocioView,
)
from negocios.views.negocio_views import PagoSuscripcionViewSet, PlanSaaSViewSet
from negocios.views.publico_views import login_empleado_pin, verificar_sesion_empleado
from negocios.views.suscripcion_views import estado_suscripcion
from negocios.views.pago_yape_views import recibir_notificacion_yape, confirmar_pago_yape, validar_pago_bot
from negocios.views.suscripcion_billing_views import generar_pago_suscripcion, webhook_mercadopago
from negocios.views.app_version_views import app_version, descargar_apk
from negocios.views.facturacion_views import emitir_comprobante, obtener_comprobante, listar_comprobantes, enviar_ticket_whatsapp_view
from negocios.views.delivery_views import pedidos_delivery, tomar_pedido, actualizar_estado_delivery, avisar_cliente
from negocios.views.historia_views import historias, cancelar_historia, historias_pendientes_bot, marcar_historia_bot
from negocios.views.cliente_views import geocodificar_bot, registrar_feedback_bot, listar_canjes, stickers_view, eliminar_sticker
from negocios.views.staff_views import (
    TicketSoporteViewSet, metricas_staff, salud_bot, salud_servidor,
    crear_negocio_staff, pagos_pendientes_staff, pagos_historial_staff,
    modulos_globales_staff, datos_pago_staff, datos_pago_negocio,
    resumen_financiero_staff, credenciales_negocio_staff,
)
from .serializers_jwt import CustomTokenObtainPairView, CustomTokenRefreshView, LogoutView, refresh_movil,login_movil
from . import views

router = DefaultRouter()

router.register(r'negocios',              views.NegocioViewSet,          basename='negocio')
router.register(r'sedes',                 views.SedeViewSet,             basename='sede')
router.register(r'detalles',              views.DetalleOrdenViewSet,     basename='detalleorden')
router.register(r'pagos',                 views.PagoViewSet,             basename='pago')
router.register(r'roles',                 views.RolViewSet,              basename='rol')
router.register(r'sesiones_caja',         views.SesionCajaViewSet,       basename='sesioncaja')
router.register(r'categorias',            views.CategoriaViewSet,        basename='categoria')
router.register(r'mesas',                 views.MesaViewSet,             basename='mesa')
router.register(r'productos',             views.ProductoViewSet,         basename='producto')
router.register(r'ordenes',               views.OrdenViewSet,            basename='orden')
router.register(r'empleados',             views.EmpleadoViewSet,         basename='empleado')
router.register(r'insumo-base',           views.InsumoBaseViewSet,       basename='insumobase')
router.register(r'insumo-sede',           views.InsumoSedeViewSet,       basename='insumosede')
router.register(r'proveedores',           views.ProveedorViewSet,        basename='proveedor')
router.register(r'ordenes-compra',        views.OrdenCompraViewSet,      basename='ordencompra')
router.register(r'modificadores-rapidos', views.ModificadorRapidoViewSet, basename='modificadorrapido')
router.register(r'grupos-variacion',      views.GrupoVariacionViewSet,   basename='grupovariacion')
router.register(r'opciones-variacion',    views.OpcionVariacionViewSet,  basename='opcionvariacion')
router.register(r'recetas-opcion',        views.RecetaOpcionViewSet,     basename='recetaopcion')
router.register(r'clientes',              views.ClienteViewSet,          basename='clientes')
router.register(r'zonas-delivery',        views.ZonaDeliveryViewSet,     basename='zonadelivery')
router.register(r'reglas-negocio',        views.ReglaNegocioViewSet,     basename='reglanegocio')
router.register(r'planes-saas',           PlanSaaSViewSet,               basename='planes-saas')
router.register(r'pagos-suscripcion',     PagoSuscripcionViewSet,        basename='pagos-suscripcion')
router.register(r'tickets-soporte',       TicketSoporteViewSet,          basename='ticket-soporte')

urlpatterns = [
    path('empleados/login-pin/',        login_empleado_pin,          name='login-empleado-pin'),
    path('empleados/verificar-sesion/', verificar_sesion_empleado,   name='verificar-sesion-empleado'),
    path('empleados/estado-bloqueo/',   estado_bloqueo_pin,          name='estado-bloqueo-pin'),
    path('', include(router.urls)),

    # ==========================================
    # 🛡️ AUTENTICACIÓN (COOKIES)
    # ==========================================
    path('login-admin/',   CustomTokenObtainPairView.as_view(), name='login-admin'),
    path('token/refresh/', CustomTokenRefreshView.as_view(),    name='token-refresh'),
    path('token/logout/',  LogoutView.as_view(),                name='token-logout'),

    # ==========================================
    # RUTAS INDEPENDIENTES
    # ==========================================
    path('negocio/configuracion/',    views.configuracion_negocio,    name='configuracion_negocio'),
    path('dashboard/metricas/',       views.metricas_dashboard,       name='metricas_dashboard'),
    path('movimientos-caja/',         views.registrar_movimiento_caja, name='registrar_movimiento_caja'),
    path('verificar-sesion/',         views.verificar_sesion,         name='verificar_sesion'),
    path('marketing/guardar-global/', MarketingGlobalView.as_view(),  name='guardar_marketing_global'),
    path('health/',                   views.health_check,             name='health_check'),

    # ==========================================
    # RUTAS PÚBLICAS (Sin Token - Carta QR)
    # ==========================================
    path('menu-publico/<int:sede_id>/',                views.menu_publico,                   name='menu_publico'),
    path('orden-publica/<int:sede_id>/<int:mesa_id>/', views.orden_publica,                  name='orden_publica'),
    path('combos-promocionales/',                      ComboPromocionalView.as_view(),       name='combos_promocionales'),
    path('combos-promocionales/<int:pk>/',             ComboPromocionalDetalleView.as_view(), name='combo_promocional_detalle'),
    path('happy-hours/',                               HappyHourView.as_view(),              name='happy_hours'),
    path('happy-hours/<int:pk>/',                      HappyHourDetalleView.as_view(),       name='happy_hour_detalle'),
    path('reglas-negocio-v2/',                         ReglaNegocioView.as_view(),           name='reglas_negocio'),
    path('reglas-negocio-v2/<int:pk>/',                ReglaNegocioDetalleView.as_view(),    name='regla_negocio_detalle'),
    path('negocio/estado-suscripcion/',                estado_suscripcion,                   name='estado-suscripcion'),
    path('movil/login/',   login_movil,   name='movil-login'),
    path('movil/refresh/', refresh_movil, name='movil-refresh'),
    # ==========================================
    # 📱 YAPE / PLIN — Validación automática
    # ==========================================
    path('yape/notificacion/',  recibir_notificacion_yape, name='yape-notificacion'),
    path('yape/confirmar/',     confirmar_pago_yape,       name='yape-confirmar'),
    path('bot/validar-pago/',   validar_pago_bot,          name='bot-validar-pago'),
    path('bot/geocodificar/',   geocodificar_bot,          name='bot-geocodificar'),
    path('bot/feedback/',       registrar_feedback_bot,    name='bot-feedback'),
    path('canjes-puntos/',      listar_canjes,             name='listar-canjes'),
    path('stickers/',           stickers_view,             name='stickers'),
    path('stickers/<int:sticker_id>/', eliminar_sticker,   name='eliminar-sticker'),

    # ==========================================
    # 💳 SUSCRIPCIÓN — Cobro con MercadoPago
    # ==========================================
    path('negocio/suscripcion/generar-pago/', generar_pago_suscripcion, name='generar-pago-suscripcion'),
    path('mp/webhook/',                        webhook_mercadopago,      name='mp-webhook'),

    # ==========================================
    # 📱 APP MÓVIL — Control de versión / forzar update
    # ==========================================
    path('app/version/', app_version, name='app-version'),
    path('app/descargar/', descargar_apk, name='app-descargar'),

    # ==========================================
    # 🧾 FACTURACIÓN ELECTRÓNICA (SUNAT)
    # ==========================================
    path('ordenes/<int:orden_id>/emitir-comprobante/', emitir_comprobante, name='emitir-comprobante'),
    path('ordenes/<int:orden_id>/comprobante/',        obtener_comprobante, name='obtener-comprobante'),
    path('ordenes/<int:orden_id>/enviar-ticket/',      enviar_ticket_whatsapp_view, name='enviar-ticket-whatsapp'),
    path('comprobantes/',                              listar_comprobantes, name='listar-comprobantes'),

    # ==========================================
    # 🛵 DELIVERY — App del repartidor (Fase 1)
    # ==========================================
    path('delivery/pedidos/',                       pedidos_delivery,            name='delivery-pedidos'),
    path('delivery/pedidos/<int:orden_id>/tomar/',  tomar_pedido,                name='delivery-tomar'),
    path('delivery/pedidos/<int:orden_id>/estado/', actualizar_estado_delivery,  name='delivery-estado'),
    path('delivery/pedidos/<int:orden_id>/avisar/', avisar_cliente,              name='delivery-avisar'),

    # ==========================================
    # 📲 HISTORIAS PROGRAMADAS (Bot WhatsApp)
    # ==========================================
    path('historias/',                          historias,                name='historias'),
    path('historias/<int:historia_id>/cancelar/', cancelar_historia,      name='cancelar-historia'),
    # Consumidos por el cron de n8n (token X-Bot-Token):
    path('bot/historias-pendientes/',           historias_pendientes_bot, name='historias-pendientes-bot'),
    path('bot/historias-marcar/',               marcar_historia_bot,      name='marcar-historia-bot'),

    # ==========================================
    # 🛠️ PANEL DE STAFF (Leybrak) — solo superusuario
    # ==========================================
    path('staff/metricas/',          metricas_staff,          name='staff-metricas'),
    path('staff/resumen-financiero/', resumen_financiero_staff, name='staff-resumen-financiero'),
    path('staff/salud-bot/',         salud_bot,               name='staff-salud-bot'),
    path('staff/salud-servidor/',    salud_servidor,          name='staff-salud-servidor'),
    path('staff/negocios/crear/',    crear_negocio_staff,     name='staff-crear-negocio'),
    path('staff/negocios/<int:negocio_id>/credenciales/', credenciales_negocio_staff, name='staff-credenciales-negocio'),
    path('staff/pagos-pendientes/',  pagos_pendientes_staff,  name='staff-pagos-pendientes'),
    path('staff/pagos-historial/',   pagos_historial_staff,   name='staff-pagos-historial'),
    path('staff/modulos-globales/',  modulos_globales_staff,  name='staff-modulos-globales'),
    path('staff/datos-pago/',        datos_pago_staff,        name='staff-datos-pago'),
    path('negocio/suscripcion/datos-pago/', datos_pago_negocio, name='negocio-datos-pago'),
]