# ============================================================
# views/historia_views.py
# Historias (estados de WhatsApp) programadas.
#
# Flujo: el dueño programa la historia desde la web (imagen + texto + fecha).
# Un cron de n8n llama cada pocos minutos a /api/bot/historias-pendientes/,
# publica cada una vía Evolution API (sendStatus) con la instancia de la sede
# y reporta el resultado en /api/bot/historias-marcar/.
#
# Los endpoints del bot son AllowAny pero exigen el token compartido
# (settings.BOT_API_TOKEN, con fallback a EVO_GLOBAL_KEY) en el header
# X-Bot-Token — misma convención que el resto de vistas externas.
# ============================================================
import logging

from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import HistoriaProgramada, Sede
from ..authentication import bot_token_valido as _token_bot_valido

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────

def _get_negocio(request):
    try:
        return request.user.negocio
    except Exception:
        return None


def _serializar(h, request=None):
    imagen_url = ''
    if h.imagen:
        base = getattr(settings, 'BACKEND_URL', '') or ''
        if base:
            imagen_url = base.rstrip('/') + h.imagen.url
        elif request is not None:
            imagen_url = request.build_absolute_uri(h.imagen.url)
        else:
            imagen_url = h.imagen.url
    return {
        'id': h.id,
        'sede': h.sede_id,
        'sede_nombre': h.sede.nombre,
        'imagen': imagen_url,
        'texto': h.texto,
        'frecuencia': h.frecuencia,
        'fecha_programada': h.fecha_programada.isoformat() if h.fecha_programada else None,
        'hora': h.hora.strftime('%H:%M') if h.hora else None,
        'dias_semana': h.dias_semana or [],
        'fecha_inicio': h.fecha_inicio.isoformat() if h.fecha_inicio else None,
        'fecha_fin': h.fecha_fin.isoformat() if h.fecha_fin else None,
        'estado': h.estado,
        'publicada_en': h.publicada_en.isoformat() if h.publicada_en else None,
        'ultima_publicacion_dia': h.ultima_publicacion_dia.isoformat() if h.ultima_publicacion_dia else None,
        'error_msg': h.error_msg,
        'creado_en': h.creado_en.isoformat(),
    }


def _telefono_a_jid(telefono):
    """Normaliza un teléfono guardado a un JID de WhatsApp (51XXXXXXXXX@s.whatsapp.net)."""
    digits = ''.join(c for c in (telefono or '') if c.isdigit())
    if not digits:
        return None
    if len(digits) == 9:        # móvil de Perú sin código de país
        digits = '51' + digits
    return f'{digits}@s.whatsapp.net'


def _destinatarios_negocio(negocio_id):
    """Lista (sin repetidos) de JIDs de los clientes del negocio — para enviarles el estado."""
    from ..models import Cliente
    tels = (Cliente.objects.filter(negocio_id=negocio_id)
            .exclude(telefono__isnull=True).exclude(telefono='')
            .values_list('telefono', flat=True))
    jids, vistos = [], set()
    for t in tels:
        jid = _telefono_a_jid(t)
        if jid and jid not in vistos:
            vistos.add(jid)
            jids.append(jid)
    return jids


# ─── Endpoints para la web (auth del dueño) ──────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def historias(request):
    """GET: lista las historias del negocio. POST: programa una nueva (multipart)."""
    negocio = _get_negocio(request)
    if negocio is None:
        return Response({'error': 'Sin negocio asociado.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        qs = HistoriaProgramada.objects.filter(sede__negocio=negocio).select_related('sede')[:100]
        return Response({'historias': [_serializar(h, request) for h in qs]})

    # POST — crear
    from django.utils.dateparse import parse_datetime, parse_date, parse_time

    sede_id = request.data.get('sede')
    imagen = request.FILES.get('imagen')
    texto = (request.data.get('texto') or '').strip()
    frecuencia = request.data.get('frecuencia') or 'unica'

    if not (sede_id and imagen):
        return Response({'error': 'Faltan datos: sede e imagen son obligatorios.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if frecuencia not in ('unica', 'diaria', 'semanal'):
        return Response({'error': "frecuencia debe ser 'unica', 'diaria' o 'semanal'."},
                        status=status.HTTP_400_BAD_REQUEST)

    sede = Sede.objects.filter(id=sede_id, negocio=negocio).first()
    if not sede:
        return Response({'error': 'La sede no pertenece a tu negocio.'}, status=status.HTTP_400_BAD_REQUEST)
    if not sede.whatsapp_instancia:
        return Response({'error': 'Esa sede no tiene WhatsApp conectado. Conéctalo primero.'},
                        status=status.HTTP_400_BAD_REQUEST)

    campos = dict(sede=sede, imagen=imagen, texto=texto, frecuencia=frecuencia)

    if frecuencia == 'unica':
        fecha = parse_datetime(request.data.get('fecha_programada') or '')
        if fecha is None:
            return Response({'error': 'Fecha y hora inválidas.'}, status=status.HTTP_400_BAD_REQUEST)
        if timezone.is_naive(fecha):
            fecha = timezone.make_aware(fecha)
        if fecha < timezone.now() - timezone.timedelta(minutes=5):
            return Response({'error': 'La fecha programada ya pasó.'}, status=status.HTTP_400_BAD_REQUEST)
        campos['fecha_programada'] = fecha
    else:
        hora = parse_time(request.data.get('hora') or '')
        if hora is None:
            return Response({'error': 'Indica la hora de publicación.'}, status=status.HTTP_400_BAD_REQUEST)
        campos['hora'] = hora
        campos['fecha_inicio'] = parse_date(request.data.get('fecha_inicio') or '') or None
        campos['fecha_fin'] = parse_date(request.data.get('fecha_fin') or '') or None
        if frecuencia == 'semanal':
            dias_raw = request.data.get('dias_semana') or '[]'
            try:
                import json
                dias = json.loads(dias_raw) if isinstance(dias_raw, str) else list(dias_raw)
            except Exception:
                dias = []
            dias = sorted({int(d) for d in dias if str(d).isdigit() and 0 <= int(d) <= 6})
            if not dias:
                return Response({'error': 'Elige al menos un día de la semana.'},
                                status=status.HTTP_400_BAD_REQUEST)
            campos['dias_semana'] = dias

    h = HistoriaProgramada.objects.create(**campos)
    return Response(_serializar(h, request), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancelar_historia(request, historia_id):
    """Cancela una historia pendiente (no se borra, queda el registro)."""
    negocio = _get_negocio(request)
    if negocio is None:
        return Response({'error': 'Sin negocio asociado.'}, status=status.HTTP_403_FORBIDDEN)

    h = HistoriaProgramada.objects.filter(id=historia_id, sede__negocio=negocio).first()
    if not h:
        return Response({'error': 'Historia no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    if h.estado != 'pendiente':
        return Response({'error': f'Solo se cancelan pendientes (está {h.estado}).'},
                        status=status.HTTP_400_BAD_REQUEST)

    h.estado = 'cancelada'
    h.save(update_fields=['estado'])
    return Response(_serializar(h, request))


# ─── Endpoints para el cron de n8n (token compartido) ────────

@api_view(['GET'])
@permission_classes([AllowAny])
def historias_pendientes_bot(request):
    """
    Devuelve las historias pendientes cuya hora ya llegó, con todo lo que n8n
    necesita para publicarlas (instancia + URL absoluta de la imagen + caption).
    Las de sedes sin instancia conectada se marcan como error.
    """
    if not _token_bot_valido(request):
        return Response({'error': 'Token inválido.'}, status=status.HTTP_403_FORBIDDEN)

    ahora = timezone.localtime()
    hoy = ahora.date()
    hora_actual = ahora.time()

    # Candidatas activas (las recurrentes se quedan 'pendiente' mientras corren)
    candidatas = (HistoriaProgramada.objects
                  .filter(estado='pendiente')
                  .select_related('sede')[:200])

    listas, sin_instancia = [], []
    for h in candidatas:
        # ¿Le toca publicarse AHORA?
        if h.frecuencia == 'unica':
            if not (h.fecha_programada and h.fecha_programada <= timezone.now()):
                continue
        else:
            # Recurrente: rango de fechas
            if h.fecha_inicio and hoy < h.fecha_inicio:
                continue
            if h.fecha_fin and hoy > h.fecha_fin:
                h.estado = 'finalizada'
                h.save(update_fields=['estado'])
                continue
            # Día de la semana (solo 'semanal'; 0=Lunes … 6=Domingo)
            if h.frecuencia == 'semanal' and hoy.weekday() not in (h.dias_semana or []):
                continue
            # Aún no llegó la hora del día
            if h.hora and hora_actual < h.hora:
                continue
            # Ya se publicó hoy
            if h.ultima_publicacion_dia == hoy:
                continue

        if not h.sede.whatsapp_instancia:
            sin_instancia.append(h)
            continue

        data = _serializar(h, request)
        data['instancia'] = h.sede.whatsapp_instancia
        # Destinatarios = clientes del negocio (nuestra BD), NO la agenda del teléfono.
        data['destinatarios'] = _destinatarios_negocio(h.sede.negocio_id)
        listas.append(data)
        if len(listas) >= 20:
            break

    for h in sin_instancia:
        h.estado = 'error'
        h.error_msg = 'La sede no tiene WhatsApp conectado.'
        h.save(update_fields=['estado', 'error_msg'])

    return Response({'historias': listas})


@api_view(['POST'])
@permission_classes([AllowAny])
def marcar_historia_bot(request):
    """n8n reporta el resultado de publicar: {id, resultado: 'publicada'|'error', error?}."""
    if not _token_bot_valido(request):
        return Response({'error': 'Token inválido.'}, status=status.HTTP_403_FORBIDDEN)

    historia_id = request.data.get('id')
    resultado = request.data.get('resultado')
    if resultado not in ('publicada', 'error'):
        return Response({'error': "resultado debe ser 'publicada' o 'error'."},
                        status=status.HTTP_400_BAD_REQUEST)

    h = HistoriaProgramada.objects.filter(id=historia_id).first()
    if not h:
        return Response({'error': 'Historia no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    if h.frecuencia == 'unica':
        # De un solo uso: queda publicada/error definitivamente.
        h.estado = resultado
        if resultado == 'publicada':
            h.publicada_en = timezone.now()
        else:
            h.error_msg = str(request.data.get('error') or 'Error al publicar.')[:1000]
        h.save(update_fields=['estado', 'publicada_en', 'error_msg'])
    else:
        # Recurrente: registra el día (anti-duplicado) y SIGUE activa ('pendiente').
        h.ultima_publicacion_dia = timezone.localdate()
        h.publicada_en = timezone.now()
        h.error_msg = '' if resultado == 'publicada' else str(request.data.get('error') or 'Error al publicar.')[:1000]
        h.save(update_fields=['ultima_publicacion_dia', 'publicada_en', 'error_msg'])

    return Response({'ok': True, 'estado': h.estado, 'frecuencia': h.frecuencia})
