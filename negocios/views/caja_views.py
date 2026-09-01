import logging

from decimal import Decimal

from django.db import transaction, IntegrityError
from django.utils import timezone
from django.db.models import Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .helpers import es_valor_nulo, get_empleado_desde_header, get_empleado_verificado
from ..models import SesionCaja, MovimientoCaja, Pago, Orden, Negocio, Sede
from ..serializers import SesionCajaSerializer

logger = logging.getLogger(__name__)


def _sede_pertenece_al_solicitante(request, sede_id):
    """
    🛡️ IDOR fix: abrir/cerrar caja tomaban el sede_id del body tal cual,
    sin validar que sea una sede del negocio del que llama — cualquier
    negocio autenticado podía abrir o cerrar la caja de OTRO negocio con
    solo adivinar/probar un sede_id (son enteros correlativos). Mismo
    patrón que ya usa registrar_movimiento_caja.
    """
    empleado = get_empleado_verificado(request)
    if empleado:
        return str(empleado.sede_id) == str(sede_id)
    if request.user.is_superuser:
        return True
    if hasattr(request.user, 'negocio'):
        return Sede.objects.filter(id=sede_id, negocio=request.user.negocio).exists()
    return False


# ============================================================
# SESION CAJA
# ============================================================

class SesionCajaViewSet(viewsets.ModelViewSet):
    queryset = SesionCaja.objects.none()
    serializer_class = SesionCajaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = SesionCaja.objects.all().order_by('-hora_apertura')

        # 🛡️ IDOR FIX: Acotar siempre al negocio del JWT antes de filtrar por sede
        if self.request.user.is_superuser:
            pass
        elif hasattr(self.request.user, 'negocio'):
            queryset = queryset.filter(sede__negocio=self.request.user.negocio)
        else:
            return queryset.none()

        empleado = get_empleado_desde_header(self.request)
        if empleado:
            return queryset.filter(sede=empleado.sede)

        sede_id_raw = self.request.query_params.get('sede_id')
        if not es_valor_nulo(sede_id_raw):
            queryset = queryset.filter(sede_id=sede_id_raw)
        return queryset

    @action(detail=False, methods=['get'])
    def estado_actual(self, request):
        empleado = get_empleado_desde_header(request)

        if empleado:
            sede_id = empleado.sede_id
        else:
            sede_id_raw = request.query_params.get('sede_id')
            sede_id = None if es_valor_nulo(sede_id_raw) else sede_id_raw

        if not sede_id:
            return Response({'error': 'Se requiere sede_id válida'}, status=400)

        if not _sede_pertenece_al_solicitante(request, sede_id):
            return Response({'error': 'No tienes permiso para ver el estado de esta sede.'}, status=403)

        sesion = SesionCaja.objects.filter(sede_id=sede_id, estado='abierta').first()
        if sesion:
            return Response({'estado': 'abierto', 'fondo': sesion.fondo_inicial, 'id': sesion.id})
        return Response({'estado': 'cerrado'})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def abrir_caja(self, request):
        empleado_id = request.data.get('empleado_id')
        sede_id = request.data.get('sede_id')
        fondo = request.data.get('fondo_inicial', 0)

        if not sede_id:
            return Response({'error': 'Falta sede_id'}, status=400)

        if not _sede_pertenece_al_solicitante(request, sede_id):
            return Response({'error': 'No tienes permiso para abrir caja en esta sede.'}, status=403)

        if SesionCaja.objects.filter(sede_id=sede_id, estado='abierta').exists():
            return Response(
                {'error': 'Ya hay una caja abierta en esta sede.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            sesion = SesionCaja.objects.create(
                empleado_abre_id=empleado_id,
                sede_id=sede_id,
                fondo_inicial=fondo,
                estado='abierta'
            )
        except IntegrityError:
            # Dos aperturas casi simultáneas pasaron el chequeo de arriba;
            # la constraint de la BD es la que realmente lo evita.
            return Response(
                {'error': 'Ya hay una caja abierta en esta sede.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response({'mensaje': 'Caja abierta con éxito', 'id': sesion.id})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def cerrar_caja(self, request):
        sede_id = request.data.get('sede_id')
        empleado_id = request.data.get('empleado_id')

        if not sede_id:
            return Response({'error': 'Se requiere sede_id'}, status=status.HTTP_400_BAD_REQUEST)

        if not _sede_pertenece_al_solicitante(request, sede_id):
            return Response({'error': 'No tienes permiso para cerrar caja en esta sede.'}, status=403)

        with transaction.atomic():
            sesion = SesionCaja.objects.select_for_update().filter(sede_id=sede_id, estado='abierta').first()
            if not sesion:
                return Response(
                    {'error': 'No hay caja abierta en esta sede o ya fue cerrada.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            pagos_turno = Pago.objects.filter(sesion_caja=sesion)
            movimientos_turno = MovimientoCaja.objects.filter(sesion_caja=sesion)

            total_efectivo = pagos_turno.filter(metodo='efectivo').aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00')
            # 'yape' y 'plin' son valores separados en Pago.metodo (no existe 'yape_plin');
            # el frontend los declara juntos en un solo campo ("Total en Yape / Plin").
            total_yape     = pagos_turno.filter(metodo__in=['yape', 'plin']).aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00')
            total_tarjeta  = pagos_turno.filter(metodo='tarjeta').aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00')
            total_digital  = total_yape + total_tarjeta

            ingresos_caja_chica = movimientos_turno.filter(tipo='ingreso').aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00')
            egresos_caja_chica  = movimientos_turno.filter(tipo='egreso').aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00')

            conteo_efectivo = Decimal(str(request.data.get('conteo_efectivo', '0.00')))
            conteo_yape     = Decimal(str(request.data.get('conteo_yape', '0.00')))
            conteo_tarjeta  = Decimal(str(request.data.get('conteo_tarjeta', '0.00')))

            esperado_efectivo   = Decimal(str(sesion.fondo_inicial)) + total_efectivo + ingresos_caja_chica - egresos_caja_chica
            diferencia_efectivo = conteo_efectivo - esperado_efectivo
            diferencia_yape     = conteo_yape - total_yape
            diferencia_tarjeta  = conteo_tarjeta - total_tarjeta

            sesion.empleado_cierra_id  = empleado_id
            sesion.hora_cierre         = timezone.now()
            sesion.ventas_efectivo     = total_efectivo
            sesion.ventas_digitales    = total_digital
            sesion.esperado_efectivo   = esperado_efectivo
            sesion.esperado_digital    = total_digital
            sesion.declarado_efectivo  = conteo_efectivo
            sesion.declarado_yape      = conteo_yape
            sesion.declarado_tarjeta   = conteo_tarjeta
            sesion.diferencia          = diferencia_efectivo
            sesion.estado              = 'cerrada'
            sesion.save()

        return Response({
            'mensaje': 'Caja cerrada correctamente',
            'diferencia': float(diferencia_efectivo),
            'diferencia_yape': float(diferencia_yape),
            'diferencia_tarjeta': float(diferencia_tarjeta),
            'resumen': {
                'esperado_efectivo': float(esperado_efectivo),
                'declarado_efectivo': float(conteo_efectivo)
            }
        })


# ============================================================
# VISTAS FUNCIONALES DE CAJA Y NEGOCIO
# ============================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def registrar_movimiento_caja(request):
    """
    🛡️ FIX #10: Verifica que el JWT tenga relación con la sede de la sesión de caja.
    """
    try:
        data = request.data
        sesion_id = data.get('sesion_caja_id')

        sesion = SesionCaja.objects.get(id=sesion_id)

        empleado = get_empleado_verificado(request)

        if empleado:
            if sesion.sede_id != empleado.sede_id:
                return Response(
                    {'error': 'No tienes permiso para registrar movimientos en esta sede.'},
                    status=403
                )
        elif hasattr(request.user, 'negocio'):
            if sesion.sede.negocio != request.user.negocio:
                return Response(
                    {'error': 'No tienes permiso para registrar movimientos en esta sede.'},
                    status=403
                )
        else:
            return Response({'error': 'No autorizado.'}, status=403)

        movimiento = MovimientoCaja.objects.create(
            sede=sesion.sede,
            sesion_caja=sesion,
            empleado_id=data.get('empleado_id'),
            tipo=data.get('tipo'),
            monto=data.get('monto'),
            concepto=data.get('concepto')
        )

        return Response({'mensaje': 'Movimiento registrado con éxito', 'id': movimiento.id}, status=201)

    except SesionCaja.DoesNotExist:
        return Response({'error': 'La sesión de caja no existe.'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def metricas_dashboard(request):
    sede_id_raw = request.query_params.get('sede_id')
    negocio_id_raw = request.query_params.get('negocio_id')
    sede_id = None if es_valor_nulo(sede_id_raw) else sede_id_raw

    hoy = timezone.localtime().date()
    ordenes_base = Orden.objects.filter(
        creado_en__date=hoy,
        estado_pago='pagado'
    ).exclude(estado='cancelado').order_by('-creado_en')

    # 🔧 FIX: filtrar correctamente según el contexto
    if sede_id:
        # Sede específica (dueño eligió una sede o admin de local)
        ordenes_hoy = ordenes_base.filter(sede_id=sede_id)
    elif not es_valor_nulo(negocio_id_raw):
        # Dueño eligió "Todas" → filtra por negocio
        ordenes_hoy = ordenes_base.filter(sede__negocio_id=negocio_id_raw)
    elif hasattr(request.user, 'negocio'):
        # Fallback: dueño autenticado sin params → usa su negocio del JWT
        ordenes_hoy = ordenes_base.filter(sede__negocio=request.user.negocio)
    else:
        ordenes_hoy = ordenes_base.none()

    total_ordenes   = ordenes_hoy.count()
    ventas_totales  = float(ordenes_hoy.aggregate(Sum('total'))['total__sum'] or 0.00)
    ticket_promedio = (ventas_totales / total_ordenes) if total_ordenes > 0 else 0.00

    actividad_reciente = [
        {
            'id': o.id,
            'origen': f"Mesa {o.mesa.numero_o_nombre}" if o.mesa else (o.cliente_nombre or "Para Llevar"),
            'total': float(o.total),
            'hora': o.creado_en.strftime("%H:%M")
        }
        for o in ordenes_hoy[:5]
    ]

    return Response({
        'ventas': ventas_totales,
        'ordenes': total_ordenes,
        'ticketPromedio': ticket_promedio,
        'actividadReciente': actividad_reciente
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def configuracion_negocio(request):
    negocio_id = request.query_params.get('negocio_id')

    if not negocio_id:
        return Response({'error': 'Debe enviar el parámetro negocio_id'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        negocio = Negocio.objects.get(id=negocio_id, activo=True)
        return Response({
            'nombre': negocio.nombre,
            'modulos': {
                'cocina':      negocio.mod_cocina_activo,
                'inventario':  negocio.mod_inventario_activo,
                'delivery':    negocio.mod_delivery_activo,
            }
        })
    except Negocio.DoesNotExist:
        return Response({'error': 'Negocio no encontrado o inactivo'}, status=status.HTTP_404_NOT_FOUND)