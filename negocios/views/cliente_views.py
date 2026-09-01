import math
import logging
import requests

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.conf import settings

from ..models import Cliente, ZonaDelivery, ReglaNegocio, Sede
from ..serializers import ClienteSerializer, ZonaDeliverySerializer, ReglaNegocioSerializer

logger = logging.getLogger(__name__)


# ============================================================
# CLIENTE
# ============================================================

class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'negocio') or user.negocio is None:
            negocio_id = self.request.query_params.get('negocio_id')
            if negocio_id:
                return Cliente.objects.filter(negocio_id=negocio_id)
            return Cliente.objects.none()
        return Cliente.objects.filter(negocio=user.negocio)

    @action(detail=False, methods=['get'], url_path='buscar_por_telefono', permission_classes=[IsAuthenticated])
    def buscar_por_telefono(self, request):
        """
        Endpoint que usa n8n para reconocer al cliente de WhatsApp.

        CREA el cliente si es la primera vez que escribe (antes solo buscaba y
        devolvía `encontrado:false` sin `id` — el bot no tenía forma de guardarle
        el nombre ni acreditarle nada hasta su primera COMPRA). Reusa el mismo
        criterio de matcheo que el POS (últimos 9 dígitos) para no duplicar
        clientes entre WhatsApp y el mostrador.
        """
        from .orden_views import _buscar_o_crear_cliente
        from ..models import Negocio

        telefono = request.query_params.get('telefono')
        negocio_id = request.query_params.get('negocio_id')

        if not telefono:
            return Response({'error': 'Falta el parámetro telefono'}, status=400)
        if not negocio_id:
            return Response({'error': 'Falta el parámetro negocio_id'}, status=400)

        negocio = Negocio.objects.filter(id=negocio_id).first()
        if not negocio:
            return Response({'error': 'Negocio no encontrado'}, status=404)

        cliente, creado = _buscar_o_crear_cliente(negocio, telefono)
        if cliente is None:
            return Response({'error': 'Teléfono inválido.'}, status=400)

        es_cumple = False
        if cliente.fecha_nacimiento:
            hoy = timezone.localtime().date()
            es_cumple = (cliente.fecha_nacimiento.day == hoy.day and
                         cliente.fecha_nacimiento.month == hoy.month)

        return Response({
            'encontrado': True,
            'es_nuevo': creado,
            'id': cliente.id,
            'nombre': cliente.nombre or "Cliente POS",
            'telefono': cliente.telefono,
            'puntos': cliente.puntos_acumulados,
            'total_gastado': float(cliente.total_gastado or 0),
            'tags': cliente.tags if isinstance(cliente.tags, list) else [],
            'es_cumpleanos_hoy': es_cumple,
        })


# ============================================================
# ZONA DELIVERY
# ============================================================

def calcular_distancia_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def geocodificar_bot(request):
    """
    Convierte una dirección de TEXTO en coordenadas (lat/lng) para el bot, así el
    cliente no tiene que mandar su ubicación GPS. Usa Nominatim (OpenStreetMap).
    Params: direccion (texto) + sede_id (opcional, sesga la búsqueda cerca del local).
    """
    direccion = (request.query_params.get('direccion') or '').strip()
    if not direccion:
        return Response({'encontrado': False, 'motivo': 'Falta la dirección.'}, status=400)

    params = {
        'q': direccion, 'format': 'json', 'limit': 1, 'countrycodes': 'pe',
    }
    sede_id = request.query_params.get('sede_id')
    sede = Sede.objects.filter(id=sede_id).first() if sede_id else None
    if sede and sede.latitud and sede.longitud:
        d = 0.25  # caja de ~25 km alrededor del local para priorizar resultados cercanos
        params['viewbox'] = f"{sede.longitud - d},{sede.latitud + d},{sede.longitud + d},{sede.latitud - d}"

    try:
        r = requests.get(
            'https://nominatim.openstreetmap.org/search', params=params,
            headers={'User-Agent': 'LeybrakPOS/1.0 (delivery geocoding)'}, timeout=8,
        )
        data = r.json()
    except Exception as e:
        logger.error('Geocoding error: %s', e)
        return Response({'encontrado': False, 'motivo': 'No se pudo geocodificar ahora.'})

    if not data:
        return Response({
            'encontrado': False,
            'motivo': 'No encontramos esa dirección. Pide que la escriba con más detalle (calle, número, distrito) o que comparta su ubicación de WhatsApp.',
        })

    res = data[0]
    return Response({
        'encontrado': True,
        'latitud': float(res['lat']),
        'longitud': float(res['lon']),
        'direccion_formateada': res.get('display_name', direccion),
    })


def _url_absoluta(imagen, request):
    if not imagen:
        return ''
    base = getattr(settings, 'BACKEND_URL', '') or ''
    if base:
        return base.rstrip('/') + imagen.url
    return request.build_absolute_uri(imagen.url) if request else imagen.url


def _serializar_sticker(s, request):
    return {
        'id': s.id,
        'contexto': s.contexto,
        'contexto_label': s.get_contexto_display(),
        'imagen': _url_absoluta(s.imagen, request),
        'activo': s.activo,
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def stickers_view(request):
    """GET: lista los stickers del negocio. POST: sube uno nuevo (multipart: imagen + contexto)."""
    from ..models import BotSticker
    negocio = getattr(request.user, 'negocio', None)
    if negocio is None:
        return Response({'error': 'Sin negocio asociado.'}, status=403)

    if request.method == 'GET':
        qs = BotSticker.objects.filter(negocio=negocio)
        return Response({'stickers': [_serializar_sticker(s, request) for s in qs]})

    imagen = request.FILES.get('imagen')
    contexto = request.data.get('contexto') or 'general'
    if not imagen:
        return Response({'error': 'Falta la imagen del sticker.'}, status=400)
    s = BotSticker.objects.create(negocio=negocio, imagen=imagen, contexto=contexto)
    return Response(_serializar_sticker(s, request), status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def eliminar_sticker(request, sticker_id):
    from ..models import BotSticker
    negocio = getattr(request.user, 'negocio', None)
    s = BotSticker.objects.filter(id=sticker_id, negocio=negocio).first() if negocio else None
    if not s:
        return Response({'error': 'Sticker no encontrado.'}, status=404)
    s.delete()
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_canjes(request):
    """Historial de canjes de puntos del negocio (para el módulo de Fidelización)."""
    from ..models import CanjePuntos
    negocio = getattr(request.user, 'negocio', None)
    if negocio is None:
        return Response({'canjes': []})
    qs = CanjePuntos.objects.filter(negocio=negocio).select_related('cliente')[:100]
    return Response({'canjes': [
        {
            'id': c.id, 'puntos': c.puntos, 'valor_soles': float(c.valor_soles),
            'cliente': c.cliente.nombre if c.cliente else None,
            'telefono': c.cliente.telefono if c.cliente else '',
            'creado_en': c.creado_en.isoformat(),
        }
        for c in qs
    ]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def registrar_feedback_bot(request):
    """
    El bot guarda el feedback/reseña del cliente para que el dueño lo revise.
    Body: { telefono, calificacion (1-5, opcional), comentario, orden_id (opcional) }
    """
    from ..models import FeedbackCliente, Orden

    negocio = getattr(request.user, 'negocio', None)
    if negocio is None:
        return Response({'error': 'Sin negocio asociado.'}, status=403)

    telefono = (request.data.get('telefono') or '').strip()
    comentario = (request.data.get('comentario') or '').strip()
    cal = request.data.get('calificacion')
    try:
        cal = int(cal) if cal not in (None, '') else None
        if cal is not None and not (1 <= cal <= 5):
            cal = None
    except (TypeError, ValueError):
        cal = None

    if not comentario and cal is None:
        return Response({'error': 'Falta una calificación (1-5) o un comentario.'}, status=400)

    cliente = (Cliente.objects.filter(negocio=negocio, telefono__icontains=telefono[-9:]).first()
               if telefono else None)
    orden = None
    orden_id = request.data.get('orden_id')
    if orden_id:
        orden = Orden.objects.filter(id=orden_id, sede__negocio=negocio).first()

    FeedbackCliente.objects.create(
        negocio=negocio, cliente=cliente, telefono=telefono,
        orden=orden, calificacion=cal, comentario=comentario,
    )
    return Response({'ok': True, 'mensaje': '¡Gracias por tu opinión! La registramos.'})


class ZonaDeliveryViewSet(viewsets.ModelViewSet):
    serializer_class = ZonaDeliverySerializer

    def get_permissions(self):
        # Lecturas y cotización quedan abiertas (las usa el bot y la carta pública);
        # crear/editar/borrar exige sesión del dueño.
        if self.action in ('list', 'retrieve', 'cotizar'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        sede_id = self.request.query_params.get('sede_id')
        # Dueño autenticado → todas SUS zonas (incluidas inactivas, para gestionarlas).
        if user and user.is_authenticated and getattr(user, 'negocio', None):
            qs = ZonaDelivery.objects.filter(sede__negocio=user.negocio)
        else:
            # Lectura pública → solo activas.
            qs = ZonaDelivery.objects.filter(activa=True)
        if sede_id:
            qs = qs.filter(sede_id=sede_id)
        return qs.order_by('radio_max_km')

    def _validar_sede_del_negocio(self, serializer):
        sede = serializer.validated_data.get('sede')
        negocio = getattr(self.request.user, 'negocio', None)
        if sede and negocio and sede.negocio_id != negocio.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('La sede no pertenece a tu negocio.')

    def perform_create(self, serializer):
        self._validar_sede_del_negocio(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self._validar_sede_del_negocio(serializer)
        serializer.save()

    @action(detail=False, methods=['get'])
    def cotizar(self, request):
        sede_id = request.query_params.get('sede_id')
        try:
            lat_cliente = float(request.query_params.get('lat', 0))
            lon_cliente = float(request.query_params.get('lon', 0))
        except ValueError:
            return Response({"error": "Las coordenadas deben ser números válidos"}, status=400)

        if not sede_id or lat_cliente == 0 or lon_cliente == 0:
            return Response({"error": "Faltan parámetros (sede_id, lat, lon)"}, status=400)

        # Subtotal opcional — permite aplicar regla delivery_gratis en la cotización
        try:
            subtotal = float(request.query_params.get('subtotal', 0))
        except ValueError:
            subtotal = 0.0

        try:
            sede = Sede.objects.get(id=sede_id)
            if not sede.latitud or not sede.longitud:
                return Response({"error": "El local no tiene coordenadas configuradas"}, status=400)

            distancia_recta = calcular_distancia_km(sede.latitud, sede.longitud, lat_cliente, lon_cliente)

            FACTOR_RUTEO = 1.5
            distancia_estimada_ruta = distancia_recta * FACTOR_RUTEO

            zona = ZonaDelivery.objects.filter(
                sede_id=sede_id,
                activa=True,
                radio_max_km__gte=distancia_estimada_ruta
            ).order_by('radio_max_km').first()

            if zona:
                costo_envio = float(zona.costo_envio)
                delivery_gratis = False

                # Aplicar regla delivery_gratis si el subtotal la activa
                if subtotal > 0:
                    regla_gratis = ReglaNegocio.objects.filter(
                        negocio=sede.negocio,
                        tipo='delivery_gratis',
                        activa=True,
                        monto_minimo_orden__lte=subtotal
                    ).first()
                    if regla_gratis:
                        costo_envio = 0.0
                        delivery_gratis = True

                respuesta = {
                    "zona": zona.nombre,
                    "costo": costo_envio,
                    "minimo": zona.pedido_minimo,
                    "distancia_km": round(distancia_estimada_ruta, 2),
                }
                if delivery_gratis:
                    respuesta["delivery_gratis"] = True
                    respuesta["mensaje_promo"] = "🎉 ¡Delivery gratis por tu pedido!"
                return Response(respuesta)
            else:
                return Response({
                    "error": f"Estás a {round(distancia_estimada_ruta, 2)}km de ruta. Por ahora nuestra cobertura máxima no llega hasta tu ubicación.",
                    "fuera_de_rango": True
                }, status=404)

        except Sede.DoesNotExist:
            return Response({"error": "Sede no encontrada"}, status=404)


# ============================================================
# REGLA NEGOCIO
# ============================================================

class ReglaNegocioViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReglaNegocioSerializer

    def get_queryset(self):
        negocio_id = self.request.query_params.get('negocio_id')
        return ReglaNegocio.objects.filter(negocio_id=negocio_id, activa=True)
