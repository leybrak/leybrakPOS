"""
Panel de staff (Leybrak): tickets de soporte que reportan los negocios,
métricas agregadas de todos los negocios, y salud del bot de WhatsApp
(Evolution API + n8n opcional) y del servidor. Todo gateado a superusuario,
salvo la creación de tickets (la hace el dueño de cada negocio).
"""
import logging
from datetime import timedelta
from decimal import Decimal

import requests
from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Negocio, Sede, Pago, Orden, PagoSuscripcion, TicketSoporte
from ..permissions import EsSuperUsuario
from ..serializers import TicketSoporteSerializer

logger = logging.getLogger(__name__)


# ============================================================
# TICKETS DE SOPORTE
# ============================================================
class TicketSoporteViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSoporteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return TicketSoporte.objects.select_related('negocio').all()
        if hasattr(self.request.user, 'negocio'):
            return TicketSoporte.objects.filter(negocio=self.request.user.negocio)
        return TicketSoporte.objects.none()

    def perform_create(self, serializer):
        # El ticket siempre queda ligado al negocio del que lo manda,
        # nunca a lo que venga en el body (evita que alguien lo cree a
        # nombre de otro negocio).
        if not hasattr(self.request.user, 'negocio'):
            raise PermissionDenied('Solo el dueño de un negocio puede reportar un ticket.')
        serializer.save(negocio=self.request.user.negocio)

    def perform_update(self, serializer):
        # Solo Leybrak resuelve/responde tickets; el dueño puede releer
        # el suyo pero no cambiarle el estado o la respuesta.
        if not self.request.user.is_superuser:
            raise PermissionDenied('Solo el equipo de soporte puede actualizar un ticket.')
        serializer.save()


# ============================================================
# MÉTRICAS AGREGADAS (todos los negocios)
# ============================================================
def _clasificar_suscripcion(negocio, ahora, ultimo_pago_por_negocio):
    """Misma regla que estado_suscripcion (suscripcion_views.py), pero
    reutilizando un solo query de PagoSuscripcion para todos los negocios
    en vez de repetirlo uno por uno."""
    if not negocio.activo:
        return 'bloqueado'
    ultimo_pago = ultimo_pago_por_negocio.get(negocio.id)
    if ultimo_pago and (ahora - ultimo_pago).days <= 31:
        return 'activo'
    if negocio.fin_prueba and ahora < negocio.fin_prueba:
        return 'prueba'
    return 'vencido'


@api_view(['GET'])
@permission_classes([EsSuperUsuario])
def metricas_staff(request):
    ahora = timezone.now()
    negocios = list(Negocio.objects.all())

    # Último pago 'pagado' por negocio, en un solo query.
    ultimo_pago_por_negocio = {}
    for pago in (PagoSuscripcion.objects
                 .filter(estado='pagado')
                 .order_by('negocio_id', '-fecha_pago')):
        ultimo_pago_por_negocio.setdefault(pago.negocio_id, pago.fecha_pago)

    conteo_estados = {'activo': 0, 'prueba': 0, 'vencido': 0, 'bloqueado': 0}
    for n in negocios:
        conteo_estados[_clasificar_suscripcion(n, ahora, ultimo_pago_por_negocio)] += 1

    modulos_adopcion = {
        campo: Negocio.objects.filter(**{campo: True}).count()
        for campo in (
            'mod_salon_activo', 'mod_cocina_activo', 'mod_inventario_activo',
            'mod_delivery_activo', 'mod_clientes_activo', 'mod_facturacion_activo',
            'mod_carta_qr_activo', 'mod_bot_wsp_activo', 'mod_ml_activo',
        )
    }

    hace_30_dias = ahora - timedelta(days=30)
    ventas_30_dias = (Pago.objects
                      .filter(estado='confirmado', fecha_pago__gte=hace_30_dias)
                      .aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00'))
    ordenes_hoy = Orden.objects.filter(creado_en__date=ahora.date()).exclude(estado='cancelado').count()

    return Response({
        'negocios': {'total': len(negocios), **conteo_estados},
        'ventas_pos_ultimos_30_dias': float(ventas_30_dias),
        'ordenes_hoy': ordenes_hoy,
        'modulos_adopcion': modulos_adopcion,
    })


# ============================================================
# SALUD DEL BOT (Evolution API por sede + n8n opcional)
# ============================================================
def _estado_evolution(instancia):
    url = f"{settings.EVO_API_URL}/instance/connectionState/{instancia}"
    headers = {"apikey": settings.EVO_GLOBAL_KEY}
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            estado = resp.json().get('instance', {}).get('state', '')
            return 'conectado' if estado == 'open' else 'desconectado'
        return 'desconectado'
    except Exception:
        return 'error'


@api_view(['GET'])
@permission_classes([EsSuperUsuario])
def salud_bot(request):
    sedes = Sede.objects.exclude(whatsapp_instancia__isnull=True).exclude(whatsapp_instancia='')

    conectadas, desconectadas, detalle = 0, 0, []
    for sede in sedes:
        estado = _estado_evolution(sede.whatsapp_instancia)
        if estado == 'conectado':
            conectadas += 1
        else:
            desconectadas += 1
        detalle.append({
            'sede_id': sede.id, 'sede_nombre': sede.nombre,
            'negocio_nombre': sede.negocio.nombre, 'estado': estado,
        })

    resultado = {
        'evolution': {
            'total_instancias': sedes.count(),
            'conectadas': conectadas,
            'desconectadas': desconectadas,
            'detalle': [d for d in detalle if d['estado'] != 'conectado'],
        },
    }

    if settings.N8N_API_URL and settings.N8N_API_KEY:
        try:
            resp = requests.get(
                f"{settings.N8N_API_URL}/api/v1/executions",
                headers={'X-N8N-API-KEY': settings.N8N_API_KEY},
                params={'status': 'error', 'limit': 20},
                timeout=5,
            )
            data = resp.json() if resp.status_code == 200 else {}
            resultado['n8n'] = {
                'configurado': True,
                'errores_recientes': len(data.get('data', [])),
            }
        except Exception as e:
            logger.warning(f"No se pudo consultar n8n: {e}")
            resultado['n8n'] = {'configurado': True, 'error': 'No se pudo conectar a n8n.'}
    else:
        resultado['n8n'] = {'configurado': False}

    return Response(resultado)


# ============================================================
# SALUD DEL SERVIDOR (CPU/RAM/disco del contenedor del backend)
# ============================================================
@api_view(['GET'])
@permission_classes([EsSuperUsuario])
def salud_servidor(request):
    import psutil

    memoria = psutil.virtual_memory()
    disco = psutil.disk_usage('/')

    return Response({
        'cpu_percent': psutil.cpu_percent(interval=0.5),
        'memoria': {
            'usado_gb': round((memoria.total - memoria.available) / (1024 ** 3), 2),
            'total_gb': round(memoria.total / (1024 ** 3), 2),
            'porcentaje': memoria.percent,
        },
        'disco': {
            'usado_gb': round(disco.used / (1024 ** 3), 2),
            'total_gb': round(disco.total / (1024 ** 3), 2),
            'porcentaje': disco.percent,
            'nota': 'Espacio del contenedor del backend, no del disco físico completo del servidor.',
        },
    })
