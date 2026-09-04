# ============================================================
# views/compras_views.py
# Proveedores + Órdenes de Compra (pedidos con estados).
#
# Sirve dos casos con el mismo motor de estados (ver OrdenCompra.origen):
#   - 'proveedor': el negocio le compra a un Proveedor externo.
#   - 'interno':   una sede pide reabastecimiento al almacén central (Matriz).
#
# El stock SOLO se actualiza en la acción `recibir` — nunca antes (ni al
# crear, ni al solicitar/confirmar/marcar en camino).
# ============================================================
import logging

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Proveedor, OrdenCompra, OrdenCompraDetalle, InsumoBase, InsumoSede
from ..serializers import ProveedorSerializer, OrdenCompraSerializer
from .helpers import get_empleado_verificado
from ..whatsapp_ticket import enviar_mensaje_whatsapp

logger = logging.getLogger(__name__)


# ============================================================
# PERMISOS
# ============================================================

def _es_dueño_o_encargado(request):
    """Dueño (sin X-Empleado-Id) o empleado con rol.puede_configurar."""
    empleado = get_empleado_verificado(request)
    if empleado is None:
        return True
    return bool(empleado.rol and empleado.rol.puede_configurar)


def _puede_crear(request, origen, sede_solicitante_id):
    empleado = get_empleado_verificado(request)
    if empleado is None:
        return True
    if empleado.rol and empleado.rol.puede_configurar:
        return True
    if origen == 'interno' and sede_solicitante_id and str(empleado.sede_id) == str(sede_solicitante_id):
        return True
    return False


def _puede_solicitar(request, orden):
    empleado = get_empleado_verificado(request)
    if empleado is None:
        return True
    if empleado.rol and empleado.rol.puede_configurar:
        return True
    return orden.creado_por_id == empleado.id


def _puede_recibir(request, orden):
    empleado = get_empleado_verificado(request)
    if empleado is None:
        return True
    if empleado.rol and empleado.rol.puede_configurar:
        return True
    if orden.origen == 'interno' and orden.sede_destino_id and empleado.sede_id == orden.sede_destino_id:
        return True
    return False


def _construir_mensaje_pedido(orden):
    lineas = [f"📦 Pedido para *{orden.proveedor.nombre}*", ""]
    for d in orden.detalles.select_related('insumo_base').all():
        lineas.append(f"- {d.cantidad_pedida} {d.insumo_base.unidad_medida} de {d.insumo_base.nombre}")
    if orden.fecha_estimada:
        lineas += ["", f"Fecha estimada de entrega: {orden.fecha_estimada.strftime('%d-%m-%Y')}"]
    if orden.notas:
        lineas += ["", f"Notas: {orden.notas}"]
    lineas += ["", "Por favor confirmar recepción de este pedido. ¡Gracias!"]
    return "\n".join(lineas)


# ============================================================
# PROVEEDORES
# ============================================================

class ProveedorViewSet(viewsets.ModelViewSet):
    serializer_class = ProveedorSerializer

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Proveedor.objects.all()
        if hasattr(self.request.user, 'negocio'):
            qs = Proveedor.objects.filter(negocio=self.request.user.negocio)
            if self.request.query_params.get('activo') == 'true':
                qs = qs.filter(activo=True)
            return qs
        return Proveedor.objects.none()

    def perform_create(self, serializer):
        serializer.save(negocio=self.request.user.negocio)


# ============================================================
# ÓRDENES DE COMPRA
# ============================================================

class OrdenCompraViewSet(viewsets.ModelViewSet):
    serializer_class = OrdenCompraSerializer

    def get_queryset(self):
        if not hasattr(self.request.user, 'negocio'):
            return OrdenCompra.objects.none()
        qs = OrdenCompra.objects.filter(negocio=self.request.user.negocio).select_related(
            'proveedor', 'sede_destino', 'sede_solicitante', 'creado_por'
        ).prefetch_related('detalles__insumo_base').order_by('-creado_en')

        params = self.request.query_params
        if params.get('estado'):
            qs = qs.filter(estado=params['estado'])
        if params.get('origen'):
            qs = qs.filter(origen=params['origen'])
        if params.get('sede_destino'):
            qs = qs.filter(sede_destino_id=params['sede_destino'])
        if params.get('sede_solicitante'):
            qs = qs.filter(sede_solicitante_id=params['sede_solicitante'])
        return qs

    def create(self, request, *args, **kwargs):
        origen = request.data.get('origen')
        sede_solicitante_id = request.data.get('sede_solicitante')
        if not _puede_crear(request, origen, sede_solicitante_id):
            return Response({'error': 'No autorizado.'}, status=403)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        empleado = get_empleado_verificado(self.request)
        serializer.save(creado_por=empleado)

    def update(self, request, *args, **kwargs):
        orden = self.get_object()
        if orden.estado != 'borrador':
            return Response({'error': 'Solo se puede editar un pedido en borrador.'}, status=400)
        empleado = get_empleado_verificado(request)
        if not (_es_dueño_o_encargado(request) or (empleado and orden.creado_por_id == empleado.id)):
            return Response({'error': 'No autorizado.'}, status=403)
        return super().update(request, *args, **kwargs)

    # --------------------------------------------------------
    # Transiciones de estado
    # --------------------------------------------------------

    @action(detail=True, methods=['post'])
    def solicitar(self, request, pk=None):
        orden = self.get_object()
        if orden.estado != 'borrador':
            return Response(
                {'error': f'No se puede solicitar un pedido en estado "{orden.get_estado_display()}".'},
                status=400,
            )
        if not _puede_solicitar(request, orden):
            return Response({'error': 'No autorizado.'}, status=403)
        orden.estado = 'solicitado'
        orden.fecha_pedido = timezone.now()
        orden.save(update_fields=['estado', 'fecha_pedido', 'actualizado_en'])
        return Response(OrdenCompraSerializer(orden, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        orden = self.get_object()
        if orden.estado != 'solicitado':
            return Response(
                {'error': f'No se puede confirmar un pedido en estado "{orden.get_estado_display()}".'},
                status=400,
            )
        if not _es_dueño_o_encargado(request):
            return Response({'error': 'No autorizado.'}, status=403)
        orden.estado = 'confirmado'
        fecha_estimada = request.data.get('fecha_estimada')
        if fecha_estimada:
            orden.fecha_estimada = fecha_estimada
        orden.save(update_fields=['estado', 'fecha_estimada', 'actualizado_en'])
        return Response(OrdenCompraSerializer(orden, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='marcar_en_camino')
    def marcar_en_camino(self, request, pk=None):
        orden = self.get_object()
        if orden.estado != 'confirmado':
            return Response(
                {'error': f'No se puede marcar en camino un pedido en estado "{orden.get_estado_display()}".'},
                status=400,
            )
        if not _es_dueño_o_encargado(request):
            return Response({'error': 'No autorizado.'}, status=403)
        orden.estado = 'en_camino'
        orden.save(update_fields=['estado', 'actualizado_en'])
        return Response(OrdenCompraSerializer(orden, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        orden = self.get_object()
        if orden.estado in ('recibido', 'cancelado'):
            return Response(
                {'error': f'No se puede cancelar un pedido en estado "{orden.get_estado_display()}".'},
                status=400,
            )
        if not _es_dueño_o_encargado(request):
            return Response({'error': 'No autorizado.'}, status=403)
        orden.estado = 'cancelado'
        motivo = request.data.get('motivo')
        if motivo:
            orden.notas = (orden.notas + '\n' if orden.notas else '') + f'Cancelado: {motivo}'
        orden.save(update_fields=['estado', 'notas', 'actualizado_en'])
        return Response(OrdenCompraSerializer(orden, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        orden = self.get_object()
        if orden.estado not in ('solicitado', 'confirmado', 'en_camino', 'recibido_parcial'):
            return Response(
                {'error': f'No se puede recibir un pedido en estado "{orden.get_estado_display()}".'},
                status=400,
            )
        if not _puede_recibir(request, orden):
            return Response({'error': 'No autorizado.'}, status=403)

        lineas = request.data.get('lineas', [])
        if not lineas:
            return Response({'error': 'Falta el detalle de cantidades recibidas.'}, status=400)

        detalles_por_id = {d.id: d for d in orden.detalles.select_related('insumo_base').all()}

        with transaction.atomic():
            for linea in lineas:
                try:
                    detalle_id = int(linea.get('detalle_id'))
                    cantidad = float(linea.get('cantidad_recibida', 0) or 0)
                except (TypeError, ValueError):
                    return Response({'error': 'Cantidad o línea inválida.'}, status=400)

                if cantidad <= 0:
                    continue

                detalle = detalles_por_id.get(detalle_id)
                if not detalle:
                    return Response({'error': f'La línea {detalle_id} no pertenece a este pedido.'}, status=400)

                restante = float(detalle.cantidad_pedida) - float(detalle.cantidad_recibida)
                cantidad_aplicar = min(cantidad, restante) if restante > 0 else 0
                if cantidad_aplicar <= 0:
                    continue

                OrdenCompraDetalle.objects.filter(id=detalle.id).update(
                    cantidad_recibida=F('cantidad_recibida') + cantidad_aplicar
                )

                if orden.sede_destino_id:
                    insumo_sede, _ = InsumoSede.objects.get_or_create(
                        insumo_base=detalle.insumo_base,
                        sede_id=orden.sede_destino_id,
                        defaults={
                            'stock_actual': 0,
                            'stock_minimo': 0,
                            'costo_unitario': detalle.costo_unitario_referencial,
                        },
                    )
                    InsumoSede.objects.filter(id=insumo_sede.id).update(
                        stock_actual=F('stock_actual') + cantidad_aplicar
                    )
                else:
                    InsumoBase.objects.filter(id=detalle.insumo_base_id).update(
                        stock_general=F('stock_general') + cantidad_aplicar
                    )

            orden.refresh_from_db()
            todo_completo = all(
                d.cantidad_recibida >= d.cantidad_pedida for d in orden.detalles.all()
            )
            orden.estado = 'recibido' if todo_completo else 'recibido_parcial'
            if todo_completo:
                orden.fecha_recepcion = timezone.now()
            orden.save(update_fields=['estado', 'fecha_recepcion', 'actualizado_en'])

        return Response(OrdenCompraSerializer(orden, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='avisar_proveedor')
    def avisar_proveedor(self, request, pk=None):
        orden = self.get_object()
        if orden.origen != 'proveedor' or not orden.proveedor_id:
            return Response({'error': 'Este pedido no tiene un proveedor asociado.'}, status=400)
        if orden.estado == 'cancelado':
            return Response({'error': 'El pedido está cancelado.'}, status=400)
        if not _es_dueño_o_encargado(request):
            return Response({'error': 'No autorizado.'}, status=403)

        telefono = orden.proveedor.telefono
        if not telefono:
            return Response({'error': 'El proveedor no tiene un número de WhatsApp registrado.'}, status=400)

        sede = orden.sede
        if not sede or not (sede.whatsapp_instancia or '').strip():
            return Response({'error': 'No hay una sede con WhatsApp configurado para enviar el mensaje.'}, status=400)

        mensaje = request.data.get('mensaje') or _construir_mensaje_pedido(orden)
        enviado = enviar_mensaje_whatsapp(orden, telefono, mensaje)
        if not enviado:
            return Response({'error': 'No se pudo enviar el mensaje de WhatsApp.'}, status=502)

        orden.whatsapp_enviado = True
        orden.whatsapp_enviado_en = timezone.now()
        orden.save(update_fields=['whatsapp_enviado', 'whatsapp_enviado_en'])
        return Response(OrdenCompraSerializer(orden, context={'request': request}).data)
