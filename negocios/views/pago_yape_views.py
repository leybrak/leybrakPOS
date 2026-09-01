# ============================================================
# views/pago_yape_views.py
# ============================================================

import re
import unicodedata
from decimal import Decimal
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


# ============================================================
# HELPERS DE PARSEO (Regex validados con pruebas reales)
# ============================================================

def _parsear_notificacion(texto: str) -> dict | None:
    """
    Parsea el texto crudo de la notificación push de Yape.
    Retorna un dict con los datos extraídos, o None si el texto no es válido.

    Formatos reales confirmados:
      YAPE: "Marco Per* te envió un pago por S/ 0.1. El cód. de seguridad es: 622"
      PLIN: "Yape! MARCO PEREZ te envió un pago por S/ 1"
    """
    if not texto:
        return None

    # --- Detectar tipo ---
    es_plin = 'cód. de seguridad' not in texto

    # --- Extraer monto ---
    match_monto = re.search(r'S/\s*([0-9]+(?:\.[0-9]+)?)', texto)
    if not match_monto:
        return None
    monto = Decimal(match_monto.group(1))

    # --- Extraer nombre ---
    if es_plin:
        # "Yape! MARCO PEREZ te envió"
        match_nombre = re.search(r'Yape!\s+(.*?)\s+te\s+envió', texto)
    else:
        # "Marco Per* te envió"
        match_nombre = re.search(r'^(.*?)\s+te\s+envió', texto)

    nombre = match_nombre.group(1).strip() if match_nombre else 'Desconocido'

    # --- Extraer código (solo Yape) ---
    codigo = None
    if not es_plin:
        match_codigo = re.search(r'seguridad\s+es:\s*(\d{3})', texto)
        codigo = match_codigo.group(1) if match_codigo else None

    return {
        'tipo':             'PLIN' if es_plin else 'YAPE',
        'monto':            monto,
        'nombre_cliente':   nombre,
        'codigo_seguridad': codigo,
    }


def _sin_acentos(texto: str) -> str:
    """Quita tildes/diacríticos para comparar ('Pérez' == 'Perez')."""
    return ''.join(c for c in unicodedata.normalize('NFD', texto)
                   if unicodedata.category(c) != 'Mn')


def _normalizar_nombre(texto: str) -> str:
    """Limpia un nombre para comparación: minúsculas, sin tildes, sin asterisco, sin espacios extra."""
    if not texto:
        return ''
    return ' '.join(_sin_acentos(texto.lower()).replace('*', '').split())


def _clave_nombre(nombre: str) -> str:
    """
    Clave de match unificada Yape/Plin: primer nombre + primera letra del primer
    apellido, normalizado. Así ambos formatos colapsan a la misma clave:
      Yape  'Marco Per*'  -> 'marco p'
      Plin  'MARCO PEREZ' -> 'marco p'
      (un solo nombre)    -> 'marco'
    """
    norm = _normalizar_nombre(nombre)
    if not norm:
        return ''
    partes = norm.split()
    if len(partes) == 1:
        return partes[0]
    return f"{partes[0]} {partes[1][0]}"


def _nombres_coinciden(nombre_pos: str, nombre_notificacion: str) -> bool:
    """
    Doble coincidencia de nombres para el match automático.
    Cubre: nombre completo, nombre parcial (3 letras Yape), solo primer nombre.
    """
    pos  = _normalizar_nombre(nombre_pos)
    noti = _normalizar_nombre(nombre_notificacion)

    if not pos or not noti:
        return False

    # Coincidencia directa o contenida (cubre "marco per" dentro de "marco perez")
    if noti in pos or pos in noti:
        return True

    # Fallback: solo primer nombre
    if pos.split()[0] == noti.split()[0]:
        return True

    return False


# ============================================================
# ENDPOINT: La app Android hace POST aquí
# ============================================================

@api_view(['POST'])
@permission_classes([AllowAny])  # La seguridad la hacemos con device_token
def recibir_notificacion_yape(request):
    """
    Recibe la notificación push capturada por la app Android del negocio.
    Autentica con device_token, parsea el texto, guarda en BD y dispara WebSocket.

    Body esperado:
    {
        "device_token": "abc123...",
        "texto_notificacion": "Marco Per* te envió un pago por S/ 25.0. El cód. de seguridad es: 847"
    }
    """
    from ..models import Negocio, NotificacionPago

    device_token       = request.data.get('device_token')
    texto_notificacion = request.data.get('texto_notificacion')

    # --- Validar campos mínimos ---
    if not device_token or not texto_notificacion:
        return Response(
            {'error': 'device_token y texto_notificacion son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # --- Autenticar el negocio por su token ---
    negocio = Negocio.objects.filter(device_token=device_token, activo=True).first()
    if not negocio:
        return Response(
            {'error': 'Token inválido.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # --- Parsear el texto de la notificación ---
    datos = _parsear_notificacion(texto_notificacion)
    if not datos:
        return Response(
            {'error': 'No se pudo parsear el texto de la notificación.'},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    # --- Guardar en la base de datos ---
    notificacion = NotificacionPago.objects.create(
        negocio          = negocio,
        tipo             = datos['tipo'],
        monto            = datos['monto'],
        codigo_seguridad = datos['codigo_seguridad'],
        nombre_cliente   = datos['nombre_cliente'],
    )

    # --- Disparar el WebSocket al grupo del negocio ---
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"pagos_negocio_{negocio.id}",
        {
            'type':             'pago.recibido',   # → llama a pago_recibido() en el consumer
            'notificacion_id':  notificacion.id,
            'tipo':             notificacion.tipo,
            'monto':            str(notificacion.monto),
            'codigo_seguridad': notificacion.codigo_seguridad,
            'nombre_cliente':   notificacion.nombre_cliente,
        }
    )

    return Response({
        'ok': True,
        'notificacion_id': notificacion.id,
        'tipo': notificacion.tipo,
        'monto': str(notificacion.monto),  # Convertido a string para que JS lo lea sin problemas
        'codigo_seguridad': notificacion.codigo_seguridad,
        'nombre_cliente': notificacion.nombre_cliente,
    }, status=status.HTTP_201_CREATED)


# ============================================================
# ENDPOINT: El cajero confirma el pago con un clic
# ============================================================

@api_view(['POST'])
def confirmar_pago_yape(request):
    """
    El cajero hizo clic en el botón de la pantalla del POS.
    Asocia la NotificacionPago a la Orden y crea el registro de Pago.

    Body esperado:
    {
        "notificacion_id": 42,
        "orden_id": 187
    }
    """
    from ..models import NotificacionPago, Orden, Pago, SesionCaja

    notificacion_id = request.data.get('notificacion_id')
    orden_id        = request.data.get('orden_id')

    if not notificacion_id or not orden_id:
        return Response(
            {'error': 'notificacion_id y orden_id son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # --- Validar que la notificación existe y aún es válida (5 min, no usada) ---
    notificacion = NotificacionPago.objects.filter(id=notificacion_id).first()
    if not notificacion:
        return Response({'error': 'Notificación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    # 🛡️ IDOR fix: no había ningún chequeo de que la notificación fuera del
    # negocio de quien llama — cualquier negocio autenticado podía confirmar
    # (y así "usar") la notificación de Yape/Plin de OTRO negocio contra su
    # propia orden, marcándola pagada sin haber cobrado nada, y de paso
    # inutilizando esa notificación para el negocio dueño real.
    if not request.user.is_superuser and getattr(request.user, 'negocio', None) != notificacion.negocio:
        return Response({'error': 'No tienes permiso sobre esta notificación.'}, status=status.HTTP_403_FORBIDDEN)

    if not notificacion.es_valida:
        return Response(
            {'error': 'Esta notificación ya fue usada o expiró (5 minutos).'},
            status=status.HTTP_409_CONFLICT
        )

    # --- Validar que la orden existe y pertenece al mismo negocio ---
    orden = Orden.objects.filter(
        id=orden_id,
        sede__negocio=notificacion.negocio
    ).first()
    if not orden:
        return Response({'error': 'Orden no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    if orden.estado_pago == 'pagado':
        return Response({'error': 'Esta orden ya fue pagada.'}, status=status.HTTP_409_CONFLICT)

    # --- Obtener la sesión de caja activa ---
    sesion_caja = SesionCaja.objects.filter(
        sede=orden.sede,
        estado='abierta'
    ).first()

    # --- Crear el Pago y marcar la notificación como usada ---
    metodo = 'yape' if notificacion.tipo == 'YAPE' else 'plin'

    Pago.objects.create(
        orden               = orden,
        metodo              = metodo,
        monto               = notificacion.monto,
        sesion_caja         = sesion_caja,
        estado              = 'confirmado',
        notificacion_origen = notificacion,
    )

    notificacion.usado = True
    notificacion.save(update_fields=['usado'])

    # 🛡️ FIX: antes marcaba 'pagado' con solo ESTE pago creado, sin
    # importar si cubría el total — un Yape parcial (ej. cuenta dividida)
    # cerraba la orden entera. cobrar_orden() ve estado_pago=='pagado' y
    # entra a la rama que YA NO procesa pagos_data, así que el resto de
    # la cuenta (efectivo/tarjeta) que el cajero cobra después nunca se
    # registraba — la plata entraba a caja pero no quedaba en ningún Pago.
    from django.db.models import Sum
    total_cubierto = (Pago.objects.filter(orden=orden, estado='confirmado')
                       .aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00'))
    if total_cubierto >= orden.total:
        orden.estado_pago = 'pagado'
        orden.save(update_fields=['estado_pago'])

    return Response({'ok': True, 'orden_id': orden.id, 'pagado_completo': total_cubierto >= orden.total}, status=status.HTTP_200_OK)

# ============================================================
# ENDPOINT: El BOT valida un pago Yape/Plin contra la notificación REAL
# (en vez de confiar solo en la captura que lee Gemini)
# ============================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validar_pago_bot(request):
    """
    Cruza el pago que dice el cliente contra la NotificacionPago real capturada por
    la app Android del negocio. Si hay una notificación válida (no usada, < 5 min) que
    coincide en monto (y código si se manda), la consume y confirma. Determinístico:
    le saca a la IA la decisión sobre el dinero.

    Body: { "monto": 25.0, "codigo": "847" (opcional, Yape), "tipo": "yape"|"plin" (opcional) }
    Respuesta: { validado: bool, ... } | { validado:false, listener_inactivo:true } si el
    negocio no usa la app (ahí el bot cae a validar por captura).
    """
    from ..models import NotificacionPago

    negocio = getattr(request.user, 'negocio', None)
    if negocio is None:
        return Response({'validado': False, 'motivo': 'Sin negocio asociado.'},
                        status=status.HTTP_403_FORBIDDEN)

    # Sin app/listener activo no hay validación automática → el bot usa la captura.
    if not negocio.device_token or not negocio.confirmacion_automatica:
        return Response({
            'validado': False,
            'listener_inactivo': True,
            'motivo': 'Validación automática no disponible para este negocio.',
        })

    try:
        monto = Decimal(str(request.data.get('monto')))
    except Exception:
        return Response({'validado': False, 'motivo': 'Monto inválido.'},
                        status=status.HTTP_400_BAD_REQUEST)

    codigo = str(request.data.get('codigo') or '').strip()
    nombre_in = str(request.data.get('nombre') or '').strip()
    tipo = str(request.data.get('tipo') or '').upper()

    limite = timezone.now() - timedelta(minutes=5)
    qs = NotificacionPago.objects.filter(
        negocio=negocio, usado=False, fecha_recepcion__gte=limite, monto=monto,
    ).order_by('-fecha_recepcion')
    if tipo in ('YAPE', 'PLIN'):
        qs = qs.filter(tipo=tipo)
    if codigo:   # Yape: si llega el código de 3 dígitos, afina aún más (opcional).
        qs = qs.filter(codigo_seguridad=codigo)

    # Match unificado Yape/Plin por NOMBRE (primer nombre + 1ra letra del apellido):
    # ese dato viene en ambas notificaciones. El código de 3 dígitos es opcional
    # (solo Yape) y se aplicó arriba como filtro extra si estaba presente.
    clave = _clave_nombre(nombre_in)
    if clave:
        notif = next((n for n in qs if _clave_nombre(n.nombre_cliente) == clave), None)
    else:
        # Sin nombre: solo aceptamos si hay UNA notificación por ese monto, para no
        # confirmar el pago equivocado cuando hay varios del mismo importe.
        candidatos = list(qs[:2])
        notif = candidatos[0] if len(candidatos) == 1 else None

    if not notif:
        return Response({
            'validado': False,
            'motivo': f'No encontramos un pago de S/ {monto} a nombre de '
                      f'"{nombre_in or "—"}" en los últimos 5 minutos. '
                      f'Verifica el monto y el nombre exactos.',
        })

    # Consumimos la notificación para que no se reutilice en otro pedido.
    notif.usado = True
    notif.save(update_fields=['usado'])

    return Response({
        'validado': True,
        'nombre_cliente': notif.nombre_cliente,
        'monto': str(notif.monto),
        'tipo': notif.tipo,
        'notificacion_id': notif.id,
    })
