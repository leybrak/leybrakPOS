# negocios/views/analitica_views.py
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, F, DecimalField
from django.db.models.functions import TruncDate, ExtractHour, Coalesce
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .helpers import es_valor_nulo
from ..models import Orden, DetalleOrden, Sede

DINERO = DecimalField(max_digits=12, decimal_places=2)


def _parsear_fecha(valor):
    if not valor:
        return None
    try:
        return datetime.strptime(valor, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analiticas_resumen(request):
    """
    Panel de Analíticas del ERP: productos/categorías más vendidos,
    evolución de ventas por día y horas pico, para un rango de fechas
    (?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD, default últimos 30
    días). Reusa el mismo filtro multi-tenant que metricas_dashboard
    (caja_views.py) para no repetir el bug de fuga entre negocios que
    hubo ahí — sede_id/negocio_id del query param se cruzan contra el
    negocio del JWT antes de confiar en ellos.
    """
    sede_id_raw = request.query_params.get('sede_id')
    negocio_id_raw = request.query_params.get('negocio_id')
    sede_id = None if es_valor_nulo(sede_id_raw) else sede_id_raw

    if not request.user.is_superuser:
        negocio_propio = getattr(request.user, 'negocio', None)
        if sede_id and not Sede.objects.filter(id=sede_id, negocio=negocio_propio).exists():
            return Response({'error': 'No autorizado'}, status=403)
        if not es_valor_nulo(negocio_id_raw) and (
            negocio_propio is None or str(negocio_propio.id) != str(negocio_id_raw)
        ):
            return Response({'error': 'No autorizado'}, status=403)

    hoy = timezone.localtime().date()
    fecha_fin = _parsear_fecha(request.query_params.get('fecha_fin')) or hoy
    fecha_inicio = _parsear_fecha(request.query_params.get('fecha_inicio')) or (fecha_fin - timedelta(days=29))

    ordenes = Orden.objects.filter(
        creado_en__date__gte=fecha_inicio,
        creado_en__date__lte=fecha_fin,
        estado_pago='pagado',
    ).exclude(estado='cancelado')

    if sede_id:
        ordenes = ordenes.filter(sede_id=sede_id)
    elif not es_valor_nulo(negocio_id_raw):
        ordenes = ordenes.filter(sede__negocio_id=negocio_id_raw)
    elif hasattr(request.user, 'negocio'):
        ordenes = ordenes.filter(sede__negocio=request.user.negocio)
    else:
        ordenes = ordenes.none()

    agregado = ordenes.aggregate(
        ingresos=Coalesce(Sum('total'), Decimal('0.00')),
        total_ordenes=Count('id'),
    )
    total_ordenes = agregado['total_ordenes']
    ingresos_totales = agregado['ingresos']
    ticket_promedio = (ingresos_totales / total_ordenes) if total_ordenes else Decimal('0.00')

    # Items anulados (activo=False) no cuentan como vendidos.
    detalles = DetalleOrden.objects.filter(orden__in=ordenes, activo=True)

    # 🛠️ El alias de la annotate no puede llamarse igual que el campo fuente
    # ('cantidad') si OTRA annotate del mismo .annotate() lo referencia con
    # F('cantidad') — Django resuelve los kwargs en orden y "cantidad" ya
    # apuntaría al Sum() recién creado (un agregado), no a la columna cruda,
    # y explota con "is an aggregate". Por eso el alias interno se llama
    # cantidad_vendida (la respuesta igual expone la clave "cantidad").
    productos_top = list(
        detalles.values('producto_id', 'producto__nombre')
        .annotate(
            cantidad_vendida=Sum('cantidad'),
            ingresos=Sum(F('cantidad') * F('precio_unitario'), output_field=DINERO),
        )
        .order_by('-cantidad_vendida')[:10]
    )

    categorias_top = list(
        detalles.values('producto__categoria_id', 'producto__categoria__nombre')
        .annotate(
            cantidad_vendida=Sum('cantidad'),
            ingresos=Sum(F('cantidad') * F('precio_unitario'), output_field=DINERO),
        )
        .order_by('-cantidad_vendida')[:10]
    )

    evolucion_qs = (
        ordenes.annotate(dia=TruncDate('creado_en'))
        .values('dia')
        .annotate(ingresos=Sum('total'), ordenes=Count('id'))
        .order_by('dia')
    )
    evolucion_ventas = [
        {'fecha': f['dia'].isoformat(), 'ingresos': float(f['ingresos'] or 0), 'ordenes': f['ordenes']}
        for f in evolucion_qs
    ]

    # Horas pico: a qué hora del día se vende más, sumado sobre todo el
    # rango (no por día) — así se ve el patrón típico (almuerzo, cena, etc.)
    horas_qs = (
        ordenes.annotate(hora=ExtractHour('creado_en'))
        .values('hora')
        .annotate(ordenes=Count('id'), ingresos=Sum('total'))
    )
    horas_por_indice = {h['hora']: h for h in horas_qs}
    horas_pico = [
        {
            'hora': h,
            'ordenes': horas_por_indice.get(h, {}).get('ordenes', 0),
            'ingresos': float(horas_por_indice.get(h, {}).get('ingresos') or 0),
        }
        for h in range(24)
    ]

    return Response({
        'rango': {'fecha_inicio': fecha_inicio.isoformat(), 'fecha_fin': fecha_fin.isoformat()},
        'resumen': {
            'ingresos_totales': float(ingresos_totales),
            'total_ordenes': total_ordenes,
            'ticket_promedio': float(ticket_promedio),
        },
        'productos_top': [
            {
                'producto_id': p['producto_id'],
                'nombre': p['producto__nombre'],
                'cantidad': p['cantidad_vendida'],
                'ingresos': float(p['ingresos'] or 0),
            }
            for p in productos_top
        ],
        'categorias_top': [
            {
                'categoria_id': c['producto__categoria_id'],
                'nombre': c['producto__categoria__nombre'] or 'Sin categoría',
                'cantidad': c['cantidad_vendida'],
                'ingresos': float(c['ingresos'] or 0),
            }
            for c in categorias_top
        ],
        'evolucion_ventas': evolucion_ventas,
        'horas_pico': horas_pico,
    })
