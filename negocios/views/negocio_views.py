import time
from urllib import response
import requests
import logging
import os                    # ✨ NUEVO
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.core.files.storage import default_storage   # ✨ NUEVO
from django.core.files.base import ContentFile          # ✨ NUEVO
from django.db.models import F
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser  # ✨ NUEVO

from ..models import Negocio, PagoSuscripcion, PlanSaaS, Sede, Orden, InsumoSede, Comprobante
from ..serializers import NegocioSerializer, PagoSuscripcionSerializer, PlanSaaSSerializer, SedeSerializer
from ..services import precargar_modulos_por_plan
from ..permissions import EsSuperUsuario

logger = logging.getLogger(__name__)


# Presets de tono → texto estructurado que se inyecta en el prompt del bot.
TONO_TEXTOS = {
    'amable':    'Sé cálido, cercano y empático; trata al cliente con afecto.',
    'directo':   'Ve al grano, sin rodeos; respuestas cortas y claras.',
    'rapido':    'Responde rápido y eficiente; prioriza cerrar el pedido.',
    'divertido': 'Usa humor ligero y un tono juguetón, sin exagerar.',
    'formal':    'Mantén un trato respetuoso y profesional, trata de usted.',
    'vendedor':  'Sugiere combos, extras y promociones de forma natural.',
}


def _construir_persona(negocio):
    """Compone el objeto `persona` para el bot a partir de los presets + texto libre."""
    tonos = [t for t in (negocio.bot_tono or []) if t in TONO_TEXTOS]
    partes = [TONO_TEXTOS[t] for t in tonos]
    if negocio.bot_personalidad:
        partes.append(negocio.bot_personalidad.strip())
    personalidad = ' '.join(partes).strip()

    reglas = [str(r).strip() for r in (negocio.bot_reglas or []) if str(r).strip()]
    if negocio.bot_instrucciones:
        reglas.append(negocio.bot_instrucciones.strip())
    instrucciones = '\n'.join(f'- {r}' for r in reglas)

    return {
        'nombre':        negocio.bot_nombre or '',
        'personalidad':  personalidad,
        'emojis':        negocio.bot_emojis or '',
        'instrucciones': instrucciones,
    }


# ============================================================
# NEGOCIO
# ============================================================

class NegocioViewSet(viewsets.ModelViewSet):
    serializer_class = NegocioSerializer

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Negocio.objects.all()
        if hasattr(self.request.user, 'negocio'):
            return Negocio.objects.filter(propietario=self.request.user)
        return Negocio.objects.none()

    def perform_update(self, serializer):
        # Si cambia el plan (ej. el panel de staff edita un negocio), precarga
        # los módulos que ese plan incluye — misma regla que NegocioAdmin.save_model
        # (negocios/services.py), para que no dependa de por dónde se edite.
        plan_anterior_id = serializer.instance.plan_id
        negocio = serializer.save()
        if negocio.plan_id and negocio.plan_id != plan_anterior_id:
            precargar_modulos_por_plan(negocio)
            negocio.save()

    # ==========================================
    # ✨ FIX 3 — GUARDAR CONFIGURACIÓN DE CARTA
    # ==========================================
    # Ruta: PATCH /api/negocios/carta_config/
    # Body: { carta_config: { ...todos los campos del editor... } }
    @action(detail=False, methods=['get', 'patch'], url_path='carta_config', permission_classes=[IsAuthenticated])
    def carta_config(self, request):
        try:
            negocio = request.user.negocio
        except Negocio.DoesNotExist:
            return Response({'error': 'Negocio no encontrado'}, status=404)

        # GET — devuelve la config actual
        if request.method == 'GET':
            return Response({
                'carta_config': negocio.carta_config or {}
            })

        # PATCH — guarda solo los campos que lleguen, sin tocar el resto del negocio
        if request.method == 'PATCH':
            nueva_config = request.data.get('carta_config', {})
            if not isinstance(nueva_config, dict):
                return Response({'error': 'carta_config debe ser un objeto JSON'}, status=400)

            # Merge: conserva claves anteriores, pisa solo las nuevas
            config_actual = negocio.carta_config or {}
            config_actual.update(nueva_config)
            negocio.carta_config = config_actual
            negocio.save(update_fields=['carta_config'])

            return Response({'ok': True, 'carta_config': negocio.carta_config})

    # ==========================================
    # ✨ SUBIDA DE IMÁGENES DE CARTA
    # ==========================================
    # Ruta: POST /api/negocios/subir_imagen_carta/
    # Form fields: tipo ('logo' | 'fondo'), imagen (File)
    @action(
        detail=False,
        methods=['post'],
        url_path='subir_imagen_carta',
        permission_classes=[IsAuthenticated],
        parser_classes=[MultiPartParser, FormParser]
    )
    def subir_imagen_carta(self, request):
        try:
            negocio = request.user.negocio
        except Negocio.DoesNotExist:
            return Response({'error': 'Negocio no encontrado'}, status=404)

        archivo = request.FILES.get('imagen')
        tipo    = request.data.get('tipo', 'logo')   # 'logo' o 'fondo'

        if not archivo:
            return Response({'error': 'No se recibió ningún archivo'}, status=400)

        if tipo not in ('logo', 'fondo'):
            return Response({'error': 'tipo debe ser "logo" o "fondo"'}, status=400)

        # Validar extensión
        ext = os.path.splitext(archivo.name)[1].lower()
        if ext not in ('.png', '.jpg', '.jpeg', '.webp', '.svg'):
            return Response({'error': 'Formato no permitido. Usa PNG, JPG, WEBP o SVG'}, status=400)

        # 🛡️ Validación de contenido real (magic bytes) — previene disfraz de archivos
        archivo.seek(0)
        header = archivo.read(16)
        archivo.seek(0)

        es_png  = header[:4] == b'\x89PNG'
        es_jpg  = header[:3] == b'\xff\xd8\xff'
        es_webp = header[:4] == b'RIFF' and header[8:12] == b'WEBP'

        if ext in ('.png',) and not es_png:
            return Response({'error': 'El archivo no es un PNG válido.'}, status=400)
        if ext in ('.jpg', '.jpeg') and not es_jpg:
            return Response({'error': 'El archivo no es un JPG válido.'}, status=400)
        if ext == '.webp' and not es_webp:
            return Response({'error': 'El archivo no es un WEBP válido.'}, status=400)
        # SVG: validación por extensión solamente (es texto XML, sin firma binaria)

        # Guardar en MEDIA: negocios/carta/{negocio_id}/{tipo}{ext}
        # Sobreescribe el archivo anterior del mismo tipo automáticamente
        ruta = f'negocios/carta/{negocio.id}/{tipo}{ext}'
        default_storage.delete(ruta)                             # borra el anterior si existe
        ruta_guardada = default_storage.save(ruta, ContentFile(archivo.read()))

        # Construir URL absoluta
        url = request.build_absolute_uri(settings.MEDIA_URL + ruta_guardada)

        # Guardar la URL dentro de carta_config
        config_actual = negocio.carta_config or {}
        config_actual[f'{tipo}Url'] = url       # logoUrl o fondoImagenUrl
        negocio.carta_config = config_actual
        negocio.save(update_fields=['carta_config'])

        return Response({'ok': True, 'url': url})

    # ==========================================
    # 🔐 CAMBIO DE CONTRASEÑA (autoservicio, dueño/admin)
    # ==========================================
    # Ruta: POST /api/negocios/cambiar_password/
    @action(detail=False, methods=['post'], url_path='cambiar_password', permission_classes=[IsAuthenticated])
    def cambiar_password(self, request):
        user = request.user
        password_actual = request.data.get('password_actual', '')
        password_nueva = request.data.get('password_nueva', '')

        if not password_actual or not password_nueva:
            return Response({'error': 'Debes ingresar la contraseña actual y la nueva.'}, status=400)
        if not user.check_password(password_actual):
            return Response({'error': 'La contraseña actual es incorrecta.'}, status=400)
        if len(password_nueva) < 8:
            return Response({'error': 'La nueva contraseña debe tener al menos 8 caracteres.'}, status=400)

        user.set_password(password_nueva)
        user.save()
        return Response({'detail': 'Contraseña actualizada correctamente.'})

    # ==========================================
    # 🔔 ALERTAS — para la campana de notificaciones del topbar (ERP)
    # ==========================================
    # Ruta: GET /api/negocios/alertas/
    # Calculadas al vuelo (sin tabla propia): suscripción, stock bajo,
    # delivery sin repartidor y comprobantes SUNAT rechazados.
    @action(detail=False, methods=['get'], url_path='alertas', permission_classes=[IsAuthenticated])
    def alertas(self, request):
        try:
            negocio = request.user.negocio
        except Negocio.DoesNotExist:
            return Response([])

        alertas = []

        # 1. Suscripción por vencer / vencida / bloqueada
        info = negocio.estado_suscripcion_info()
        estado_sus = info['estado']
        dias = info['dias_restantes']
        if estado_sus == 'bloqueado':
            alertas.append({
                'tipo': 'suscripcion', 'nivel': 'danger',
                'titulo': 'Cuenta bloqueada',
                'mensaje': 'Tu negocio está bloqueado por falta de pago. Regulariza tu suscripción para seguir operando.',
                'vista': 'negocio',
            })
        elif estado_sus == 'vencido':
            alertas.append({
                'tipo': 'suscripcion', 'nivel': 'danger',
                'titulo': 'Suscripción vencida',
                'mensaje': 'Tu suscripción venció. Realiza el pago para evitar el bloqueo de tu cuenta.',
                'vista': 'negocio',
            })
        elif estado_sus in ('prueba', 'activo') and dias <= 3:
            etiqueta = 'de prueba' if estado_sus == 'prueba' else 'de tu plan actual'
            alertas.append({
                'tipo': 'suscripcion', 'nivel': 'warning',
                'titulo': f'Quedan {dias} día{"s" if dias != 1 else ""} {etiqueta}',
                'mensaje': 'Renueva pronto para no perder acceso al sistema.',
                'vista': 'negocio',
            })

        # 2. Stock bajo (si el módulo inventario está activo)
        if negocio.mod_inventario_activo:
            insumos_bajos = InsumoSede.objects.filter(
                sede__negocio=negocio, stock_actual__lte=F('stock_minimo')
            ).select_related('insumo_base')
            n = insumos_bajos.count()
            if n > 0:
                nombres = ', '.join(i.insumo_base.nombre for i in insumos_bajos[:3])
                extra = f' y {n - 3} más' if n > 3 else ''
                alertas.append({
                    'tipo': 'stock_bajo', 'nivel': 'warning',
                    'titulo': f'{n} insumo{"s" if n != 1 else ""} con stock bajo',
                    'mensaje': f'{nombres}{extra}.',
                    'vista': 'inventario',
                })

        # 3. Pedidos de delivery sin repartidor asignado
        if negocio.mod_delivery_activo:
            n = (Orden.objects
                 .filter(sede__negocio=negocio, tipo='delivery', estado_delivery='pendiente')
                 .exclude(estado='cancelado')
                 .count())
            if n > 0:
                alertas.append({
                    'tipo': 'delivery_pendiente', 'nivel': 'warning',
                    'titulo': f'{n} pedido{"s" if n != 1 else ""} de delivery sin repartidor',
                    'mensaje': 'Hay pedidos de delivery esperando que un repartidor los tome.',
                    'vista': None,
                })

        # 4. Comprobantes SUNAT rechazados (últimos 7 días)
        if negocio.mod_facturacion_activo and negocio.facturacion_emision != 'desactivado':
            desde = timezone.now() - timedelta(days=7)
            n = Comprobante.objects.filter(
                negocio=negocio, estado_sunat='rechazado', creado_en__gte=desde
            ).count()
            if n > 0:
                alertas.append({
                    'tipo': 'comprobante_error', 'nivel': 'danger',
                    'titulo': f'{n} comprobante{"s" if n != 1 else ""} con error SUNAT',
                    'mensaje': 'Revisa los comprobantes rechazados en Facturación SUNAT.',
                    'vista': 'facturacion',
                })

        return Response(alertas)

    # ============================================================
    # El resto de los métodos no cambia
    # ============================================================

    @action(detail=False, methods=['get'], url_path='consultar_ruc/(?P<ruc>[0-9]{11})', permission_classes=[IsAuthenticated])
    def consultar_ruc(self, request, ruc=None):
        token = getattr(settings, 'APIS_NET_PE_TOKEN', None)
        if not token:
            return Response({'error': 'Token no configurado.'}, status=500)
        try:
            response = requests.get(
                'https://api.decolecta.com/v1/sunat/ruc',
                params={'numero': ruc},
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json',
                },
                timeout=8
            )
            if response.status_code != 200:
                return Response({'error': 'RUC no encontrado en SUNAT.'}, status=404)

            data = response.json()
            return Response({
                'ruc':          data.get('numero_documento', ruc),
                'razon_social': data.get('razon_social', ''),
                'estado':       data.get('estado', 'DESCONOCIDO'),
            })
        except requests.Timeout:
            return Response({'error': 'Timeout.'}, status=504)
        except Exception as e:
            logger.error(f"Error SUNAT RUC {ruc}: {e}")
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'], url_path='consultar_dni/(?P<dni>[0-9]{8})', permission_classes=[IsAuthenticated])
    def consultar_dni(self, request, dni=None):
        """Consulta el nombre de una persona por su DNI (RENIEC vía decolecta)."""
        token = getattr(settings, 'APIS_NET_PE_TOKEN', None)
        if not token:
            return Response({'error': 'Token no configurado.'}, status=500)
        try:
            response = requests.get(
                'https://api.decolecta.com/v1/reniec/dni',
                params={'numero': dni},
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json',
                },
                timeout=8
            )
            if response.status_code != 200:
                return Response({'error': 'DNI no encontrado en RENIEC.'}, status=404)

            data = response.json()
            nombre = data.get('full_name') or ' '.join(filter(None, [
                data.get('first_name', ''),
                data.get('first_last_name', ''),
                data.get('second_last_name', ''),
            ])).strip()
            return Response({
                'dni':    data.get('document_number', dni),
                'nombre': nombre,
            })
        except requests.Timeout:
            return Response({'error': 'Timeout.'}, status=504)
        except Exception as e:
            logger.error(f"Error RENIEC DNI {dni}: {e}")
            return Response({'error': str(e)}, status=500)


# ============================================================
# SEDE  (sin cambios)
# ============================================================

class SedeViewSet(viewsets.ModelViewSet):
    serializer_class = SedeSerializer
    
    def get_queryset(self):
        if self.request.user.is_superuser:
            return Sede.objects.all()
        if hasattr(self.request.user, 'negocio'):
            return Sede.objects.filter(negocio=self.request.user.negocio)
        return Sede.objects.none()

    def perform_create(self, serializer):
        negocio = self.request.user.negocio
        cantidad_actual = Sede.objects.filter(negocio=negocio, activo=True).count()
        limite = negocio.plan.max_sedes if negocio.plan else 1
        if cantidad_actual >= limite:
            raise ValidationError({
                "detail": f"¡Límite alcanzado! Tu plan actual permite un máximo de {limite} sedes. Contáctanos para subir de plan."
            })
        serializer.save(negocio=negocio)

    @action(detail=False, methods=['get'], url_path='info_bot', permission_classes=[AllowAny])
    def info_bot(self, request):
        instancia = request.query_params.get('instancia')
        if not instancia:
            return Response({'error': 'Falta el parámetro instancia'}, status=400)
            
        sede = Sede.objects.filter(whatsapp_instancia=instancia).first()
        if not sede:
            return Response({'error': 'Instancia no registrada en ninguna Sede'}, status=404)

        # ✨ 1. OBTENEMOS LA HORA Y DÍA ACTUAL
        ahora = timezone.localtime() # Obtiene la hora en la zona de Perú (America/Lima)
        hora_actual = ahora.time()
        
        # Mapeamos los días de Python (0=Lunes, 6=Domingo) con tus datos
        dias_espanol = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        dia_actual_str = dias_espanol[ahora.weekday()]

        esta_abierto = False
        dias_atencion = sede.dias_atencion or []

        # ✨ 2. LÓGICA DE APERTURA Y CIERRE
        if dia_actual_str in dias_atencion and sede.hora_apertura and sede.hora_cierre:
            if sede.hora_apertura <= sede.hora_cierre:
                # Horario normal en el mismo día (Ej: 10:00 a 22:00)
                if sede.hora_apertura <= hora_actual <= sede.hora_cierre:
                    esta_abierto = True
            else:
                # Horario nocturno/madrugada (Ej: 18:00 a 02:00)
                if hora_actual >= sede.hora_apertura or hora_actual <= sede.hora_cierre:
                    esta_abierto = True

        # Formateamos bonito para que el bot no lea los segundos
        str_apertura = sede.hora_apertura.strftime('%H:%M') if sede.hora_apertura else 'No definido'
        str_cierre = sede.hora_cierre.strftime('%H:%M') if sede.hora_cierre else 'No definido'
        dias_texto = ", ".join(dias_atencion) if dias_atencion else "ninguno"

        negocio = sede.negocio

        # 🎟️ Stickers configurados (uno por contexto, los activos)
        from ..models import BotSticker
        _base = getattr(settings, 'BACKEND_URL', '') or ''
        stickers = {}
        for st in BotSticker.objects.filter(negocio=negocio, activo=True):
            if st.contexto not in stickers and st.imagen:
                stickers[st.contexto] = (_base.rstrip('/') + st.imagen.url) if _base else request.build_absolute_uri(st.imagen.url)

        # 🍳 Estado de la cocina: ¿saturada? (para que el bot avise demoras)
        from ..models import Orden
        pedidos_en_cocina = Orden.objects.filter(sede=sede, estado='preparando').count()
        max_cocina = sede.bot_max_pedidos_pendientes or 0
        cocina_saturada = bool(max_cocina) and pedidos_en_cocina >= max_cocina

        return Response({
            'sede_id':       sede.id,
            'negocio_id':    negocio.id,
            'nombre_sede':   sede.nombre,
            'nombre_negocio': negocio.nombre,
            # 👇 EL CEREBRO DEL BOT 👇
            'esta_abierto':  esta_abierto,
            'hora_apertura': str_apertura,
            'hora_cierre':   str_cierre,
            'mensaje_fuera_horario': f"¡Hola! Ahora mismo estamos cerrados 😴. Nuestro horario es de {str_apertura} a {str_cierre} los días {dias_texto}.",
            # ⚙️ Comportamiento configurable (n8n lo respeta)
            # Puntos: se controla a nivel NEGOCIO (módulo Fidelización → Puntos y Canje).
            'puntos_activos':     negocio.puntos_activo,
            'puntos_valor_soles': float(negocio.puntos_valor_soles),
            'puntos_canje_minimo': negocio.puntos_canje_minimo,
            'ingreso_automatico': sede.bot_ingreso_automatico,
            'pedidos_en_cocina':  pedidos_en_cocina,
            'max_pedidos_cocina': max_cocina,
            'cocina_saturada':    cocina_saturada,
            'stickers':           stickers,
            # 🤖 PERSONALIDAD CONFIGURABLE (la inyecta n8n en el prompt del LLM).
            # El backend compone el texto estructurado desde los presets de tono + reglas.
            'persona': _construir_persona(negocio),
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def crear_instancia_whatsapp(self, request, pk=None):
        sede = self.get_object()
        nombre_instancia = f"brava_{sede.negocio.id}_sede_{sede.id}"
        headers = {
            "apikey": settings.EVO_GLOBAL_KEY,
            "Content-Type": "application/json"
        }
        url_logout = f"{settings.EVO_API_URL}/instance/logout/{nombre_instancia}"
        url_borrar = f"{settings.EVO_API_URL}/instance/delete/{nombre_instancia}"
        try:
            requests.delete(url_logout, headers=headers, timeout=5)
            time.sleep(1)
            requests.delete(url_borrar, headers=headers, timeout=5)
            time.sleep(1)
        except Exception:
            pass

        url_crear = f"{settings.EVO_API_URL}/instance/create"
        payload_crear = {
            "instanceName": nombre_instancia,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
            "syncFullHistory": False,
            "readMessages": True
        }
        try:
            res_crear = requests.post(url_crear, json=payload_crear, headers=headers)
            if res_crear.status_code in [200, 201]:
                data = res_crear.json()
                qr_base64 = data.get('qrcode', {}).get('base64')

                url_webhook_n8n = f"https://silvadata.me/n8n/webhook/9b66058c-df85-41ce-aeac-1e6a15414914?instancia={nombre_instancia}"
                url_set_webhook = f"{settings.EVO_API_URL}/webhook/set/{nombre_instancia}"
                payload_webhook = {
                    "webhook": {
                        "enabled": True,
                        "url": url_webhook_n8n,
                        "webhookByEvents": False,
                        "webhookBase64": False,
                        "events": ["MESSAGES_UPSERT"]
                    }
                }
                time.sleep(1)
                requests.post(url_set_webhook, json=payload_webhook, headers=headers)

                if not qr_base64:
                    time.sleep(2)
                    url_qr = f"{settings.EVO_API_URL}/instance/connect/{nombre_instancia}"
                    res_qr = requests.get(url_qr, headers=headers)
                    if res_qr.status_code == 200:
                        qr_base64 = res_qr.json().get('base64')

                sede.whatsapp_instancia = nombre_instancia
                sede.save()
                return Response({
                    "mensaje": "Instancia creada y Webhook armado",
                    "instancia": nombre_instancia,
                    "qr_base64": qr_base64
                })
            return Response({"error": res_crear.json()}, status=res_crear.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def obtener_qr(self, request, pk=None):
        sede = self.get_object()
        if not sede.whatsapp_instancia:
            return Response({"error": "La sede no tiene instancia vinculada"}, status=400)
        url = f"{settings.EVO_API_URL}/instance/connect/{sede.whatsapp_instancia}"
        headers = {"apikey": settings.EVO_GLOBAL_KEY}
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                return Response(response.json())
            return Response({"error": "No se pudo obtener el QR"}, status=response.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=True, methods=['delete'], permission_classes=[IsAuthenticated])
    def eliminar_instancia(self, request, pk=None):
        sede = self.get_object()
        instancia_nombre = sede.whatsapp_instancia
        if not instancia_nombre:
            return Response({"mensaje": "No hay instancia activa en la base de datos"}, status=200)
        url = f"{settings.EVO_API_URL}/instance/delete/{instancia_nombre}"
        headers = {"apikey": settings.EVO_GLOBAL_KEY}
        try:
            response = requests.delete(url, headers=headers)
        except Exception as e:
            print(f"Error de conexión con Evolution API: {e}")
        sede.whatsapp_instancia = None
        sede.whatsapp_numero = None
        sede.save()
        return Response({
            "mensaje": "Conexión desconectada localmente",
            "info_api": "Instancia removida del servidor o ya no existía"
        })

    @action(detail=True, methods=['get'], url_path='estado_conexion', permission_classes=[IsAuthenticated])
    def estado_conexion(self, request, pk=None):
        sede = self.get_object()
        if not sede.whatsapp_instancia:
            return Response({"estado": "desconectado"})
        url = f"{settings.EVO_API_URL}/instance/connectionState/{sede.whatsapp_instancia}"
        headers = {"apikey": settings.EVO_GLOBAL_KEY}
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                estado_evo = data.get("instance", {}).get("state", "")
                if estado_evo == "open":
                    return Response({"estado": "conectado"})
                return Response({"estado": "esperando"})
            return Response({"estado": "desconectado"})
        except Exception as e:
            return Response({"error": str(e)}, status=500)
    @action(detail=True, methods=['get'], url_path='plan_info', permission_classes=[IsAuthenticated])
    def plan_info(self, request, pk=None):
        """
        Devuelve datos del plan del negocio + uso de recursos.
        Usado por el tab 'Plan SaaS y Límites' del frontend.
        """
        negocio = self.get_object()
    
        plan = negocio.plan
        plan_data = None
        if plan:
            plan_data = {
                'nombre':           plan.nombre,
                'precio_mensual':   str(plan.precio_mensual),
                'max_sedes':        plan.max_sedes,
                'modulo_kds':       plan.modulo_kds,
                'modulo_inventario':plan.modulo_inventario,
                'modulo_delivery':  plan.modulo_delivery,
                'modulo_carta_qr':  plan.modulo_carta_qr,
                'modulo_bot_wsp':   plan.modulo_bot_wsp,
                'modulo_ml':        plan.modulo_ml,
            }
    
        sedes_usadas = negocio.sedes.filter(activo=True).count()
    
        return Response({
            'plan':         plan_data,
            'fin_prueba':   negocio.fin_prueba,
            'activo':       negocio.activo,
            'activo_pago':  getattr(negocio, 'activo_pago', False),  # Añadir campo cuando implementes pagos
            'uso': {
                'sedes_usadas': sedes_usadas,
                'sedes_max':    plan.max_sedes if plan else 1,
            },
        })
    
class PlanSaaSViewSet(viewsets.ModelViewSet):
    """
    GET (list/retrieve) lo puede ver cualquier autenticado — el negocio
    necesita ver los planes para "contratar" uno. Crear/editar/borrar es
    solo del panel de staff.
    Ruta: /api/planes-saas/
    """
    serializer_class   = PlanSaaSSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlanSaaS.objects.all().order_by('precio_mensual')

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [EsSuperUsuario()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        # El FK Negocio.plan es PROTECT — sin este chequeo, borrar un plan
        # en uso tira un ProtectedError sin manejar (500 crudo).
        en_uso = instance.negocios.count()
        if en_uso:
            raise ValidationError(
                f'No se puede borrar: {en_uso} negocio(s) todavía usan este plan.'
            )
        instance.delete()


class PagoSuscripcionViewSet(viewsets.ModelViewSet):
    """
    GET  /api/pagos-suscripcion/              → lista del negocio autenticado
    POST /api/pagos-suscripcion/              → registrar pago (superadmin o sistema)
    GET  /api/pagos-suscripcion/{id}/         → detalle
    PATCH /api/pagos-suscripcion/{id}/        → actualizar estado (ej: pendiente → pagado)
    """
    serializer_class   = PagoSuscripcionSerializer
    permission_classes = [IsAuthenticated]
 
    def get_queryset(self):
        # Superadmin ve todos; el dueño solo ve los suyos
        if self.request.user.is_superuser:
            negocio_id = self.request.query_params.get('negocio_id')
            if negocio_id:
                return PagoSuscripcion.objects.filter(negocio_id=negocio_id)
            return PagoSuscripcion.objects.all()
 
        try:
            return PagoSuscripcion.objects.filter(negocio=self.request.user.negocio)
        except Exception:
            return PagoSuscripcion.objects.none()
 
    # Métodos que un dueño puede auto-reportar (sin pasarela): Leybrak los
    # confirma a mano viendo el comprobante. 'tarjeta'/'efectivo'/'otro'
    # quedan reservados para que el staff los registre directamente ya
    # confirmados (ej. MercadoPago, o un pago que verificó por otro medio).
    METODOS_AUTORREPORTABLES = ('yape', 'plin', 'transferencia')

    def perform_create(self, serializer):
        if self.request.user.is_superuser:
            negocio_id = self.request.data.get('negocio')
            serializer.save(negocio_id=negocio_id)
            return

        # Un dueño puede reportar SU propio pago, pero siempre queda
        # 'pendiente' hasta que staff lo revise — nunca puede auto-aprobarse.
        if not hasattr(self.request.user, 'negocio'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No tienes un negocio asociado.")
        metodo = serializer.validated_data.get('metodo_pago')
        if metodo not in self.METODOS_AUTORREPORTABLES:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                f"Solo puedes reportar pagos por: {', '.join(self.METODOS_AUTORREPORTABLES)}."
            )
        serializer.save(negocio=self.request.user.negocio, estado='pendiente')

    def perform_update(self, serializer):
        # Aprobar/rechazar un pago (estado, notas) es solo de staff — evita
        # que un dueño se auto-apruebe la suscripción sin pagar.
        if not self.request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Solo el equipo de soporte puede actualizar un pago.")
        serializer.save()
 