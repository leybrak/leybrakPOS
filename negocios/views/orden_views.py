import json
import logging
import requests

from decimal import Decimal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.db import models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .helpers import es_valor_nulo, get_empleado_desde_header, get_empleado_verificado
from ..services import aplicar_reglas_negocio, calcular_preview_happy_hours
from ..models import (
    Orden, DetalleOrden, DetalleOrdenOpcion, Pago,
    Producto, OpcionVariacion, Cliente, SolicitudCambio, SesionCaja, RegistroAuditoria, Sede,
    CanjePuntos
)
from ..serializers import OrdenSerializer, DetalleOrdenSerializer, PagoSerializer
from django.db.models import Sum, Count

logger = logging.getLogger(__name__)


def _normalizar_telefono(telefono):
    """Deja solo dígitos. '932 264 014' → '932264014', '+51 932...' → '51932...'."""
    return ''.join(ch for ch in (telefono or '') if ch.isdigit())


def _buscar_o_crear_cliente(negocio, telefono, nombre=None):
    """
    Busca el cliente del negocio por los últimos 9 dígitos del teléfono (igual que
    el bot), para que POS y WhatsApp compartan el MISMO registro y los puntos no se
    repartan entre duplicados. Si no existe, lo crea. Devuelve (cliente, creado) o
    (None, False) si el teléfono es inválido.
    """
    from ..models import Cliente
    limpio = _normalizar_telefono(telefono)
    if len(limpio) < 9:
        return None, False
    sufijo = limpio[-9:]
    cliente = Cliente.objects.filter(negocio=negocio, telefono__icontains=sufijo).first()
    if cliente:
        return cliente, False
    cliente = Cliente.objects.create(negocio=negocio, telefono=limpio, nombre=nombre or 'Cliente POS')
    return cliente, True


def acreditar_compra_cliente(orden):
    """
    Registra la compra en el CRM y acredita puntos al cliente. SIEMPRE corre
    (crear cliente y sumar puntos no dependen de `puntos_activo`; ese flag solo
    controla que el bot mencione/permita canjear). Idempotente vía
    `orden.puntos_otorgados`, así no acredita dos veces aunque la orden pase por
    varias vías (POS, Yape, bot). No-op si no hay teléfono válido.
    """
    if getattr(orden, 'puntos_otorgados', False):
        return
    negocio = orden.sede.negocio
    cliente, _creado = _buscar_o_crear_cliente(negocio, orden.cliente_telefono, orden.cliente_nombre)
    if cliente is None:
        return

    creado = _creado
    cliente.cantidad_pedidos += 1
    cliente.total_gastado = Decimal(str(cliente.total_gastado)) + Decimal(str(orden.total))
    cliente.ultima_compra = timezone.now()
    # Puntos: siempre se acumulan (puntos_por_sol default = 1).
    cliente.puntos_acumulados += int(Decimal(str(orden.total)) * negocio.puntos_por_sol)

    tags = cliente.tags if isinstance(cliente.tags, list) else []
    if cliente.total_gastado >= Decimal('500.00') and 'VIP' not in tags:
        tags.append('VIP')
    if creado and 'Nuevo' not in tags:
        tags.append('Nuevo')
    elif not creado and 'Nuevo' in tags:
        tags.remove('Nuevo')
    cliente.tags = tags
    cliente.save()

    orden.puntos_otorgados = True
    orden.save(update_fields=['puntos_otorgados', 'cliente_telefono'])


def _calcular_descuento_puntos(negocio, cliente, puntos_solicitados):
    """
    Valida un canje de puntos. Devuelve (puntos_a_usar, descuento_soles, error).
    No descuenta nada: solo calcula. La deducción se hace al crear la orden.
    """
    from decimal import Decimal as _D
    if not getattr(negocio, 'puntos_activo', False) or not cliente:
        return 0, _D('0'), None
    try:
        p = int(puntos_solicitados or 0)
    except (TypeError, ValueError):
        return 0, _D('0'), 'Puntos inválidos.'
    if p <= 0:
        return 0, _D('0'), None
    saldo = cliente.puntos_acumulados or 0
    if p < negocio.puntos_canje_minimo:
        return 0, _D('0'), f'El mínimo para canjear es {negocio.puntos_canje_minimo} puntos.'
    if p > saldo:
        return 0, _D('0'), f'El cliente solo tiene {saldo} puntos.'
    descuento = (_D(p) * negocio.puntos_valor_soles).quantize(_D('0.01'))
    return p, descuento, None


def _procesar_opciones(opciones_ids_raw, variaciones_dict):
    opciones_ids = list(opciones_ids_raw)
    for grupo_id, ids in variaciones_dict.items():
        if isinstance(ids, list):
            opciones_ids.extend(ids)

    subtotal = Decimal('0.00')
    opciones_a_guardar = []

    for opc_raw in opciones_ids:
        opc_id = opc_raw.get('id') if isinstance(opc_raw, dict) else opc_raw
        if opc_id is not None:
            try:
                opcion = OpcionVariacion.objects.get(id=opc_id)
                subtotal += opcion.precio_adicional
                opciones_a_guardar.append(opcion)
            except OpcionVariacion.DoesNotExist:
                pass

    return opciones_a_guardar, subtotal


# ============================================================
# ORDEN
# ============================================================

class OrdenViewSet(viewsets.ModelViewSet):
    serializer_class = OrdenSerializer

    def get_queryset(self):
        queryset = Orden.objects.prefetch_related(
            'detalles__producto', 'detalles__opciones_seleccionadas'
        ).all()

        if self.request.user.is_superuser:
            pass
        elif hasattr(self.request.user, 'negocio'):
            queryset = queryset.filter(sede__negocio=self.request.user.negocio)
        else:
            return queryset.none()

        empleado = get_empleado_desde_header(self.request)
        sede_id_filtrar = None
        modo = self.request.query_params.get('modo')

        if empleado:
            sede_id_filtrar = empleado.sede_id
        else:
            sede_id_raw = self.request.query_params.get('sede_id')
            if not es_valor_nulo(sede_id_raw):
                sede_id_filtrar = sede_id_raw

        if modo == 'dashboard':
            hace_35_dias = timezone.now() - timezone.timedelta(days=35)
            queryset = queryset.filter(
                estado_pago='pagado',
                creado_en__gte=hace_35_dias
            ).exclude(estado='cancelado').order_by('-creado_en')
            if sede_id_filtrar:
                queryset = queryset.filter(sede_id=sede_id_filtrar)
        else:
            if sede_id_filtrar:
                hoy = timezone.now().date()
                queryset = queryset.filter(
                    sede_id=sede_id_filtrar
                ).exclude(estado='cancelado').filter(
                    models.Q(estado_pago='pendiente') | models.Q(creado_en__date=hoy)
                ).order_by('-creado_en')
            else:
                queryset = queryset.order_by('-creado_en')

        # ✅ Filtros adicionales por query params
        tipo = self.request.query_params.get('tipo')
        if not es_valor_nulo(tipo):
            queryset = queryset.filter(tipo=tipo)

        estado = self.request.query_params.get('estado')
        if not es_valor_nulo(estado):
            queryset = queryset.filter(estado=estado)
        
        mesa = self.request.query_params.get('mesa')
        if not es_valor_nulo(mesa):
            queryset = queryset.filter(mesa_id=mesa)

        return queryset


    def perform_create(self, serializer):
        empleado = get_empleado_desde_header(self.request)
        sede_id_solicitada = self.request.data.get('sede')

        if empleado:
            sede_id_validada = empleado.sede_id
        elif hasattr(self.request.user, 'negocio'):
            if not sede_id_solicitada:
                from rest_framework.exceptions import ValidationError as DRFValidationError
                raise DRFValidationError({'sede': 'Debes indicar una sede para la orden.'})
            if not Sede.objects.filter(
                id=sede_id_solicitada,
                negocio=self.request.user.negocio
            ).exists():
                from rest_framework.exceptions import ValidationError as DRFValidationError
                raise DRFValidationError({'sede': 'La sede indicada no pertenece a tu negocio.'})
            sede_id_validada = sede_id_solicitada
        else:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No tienes permiso para crear órdenes.')

        with transaction.atomic():
            orden = serializer.save(mesero=empleado, sede_id=sede_id_validada)
            detalles_data = self.request.data.get('detalles', [])
            nuevo_total = Decimal('0.00')

            for d in detalles_data:
                producto = Producto.objects.get(id=d['producto'])
                if not producto.disponible:
                    return Response(
                        {'error': f'"{producto.nombre}" está agotado y no puede agregarse.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                precio_seguro = producto.precio_base

                notas = d.get('notas_y_modificadores', {})
                if isinstance(notas, str):
                    try:
                        notas = json.loads(notas) if notas.strip() else {}
                    except Exception:
                        notas = {}

                variaciones_dict = notas.get('variaciones', {})
                # Compat: web manda 'opciones', la app móvil 'opciones_seleccionadas'.
                opciones_ids_raw = d.get('opciones', []) or d.get('opciones_seleccionadas', [])
                opciones_a_guardar, subtotal_opciones = _procesar_opciones(opciones_ids_raw, variaciones_dict)
                precio_final_unitario = precio_seguro + subtotal_opciones

                detalle = DetalleOrden.objects.create(
                    orden=orden,
                    producto=producto,
                    cantidad=d['cantidad'],
                    precio_unitario=precio_final_unitario,
                    notas_y_modificadores=notas,
                    notas_cocina=d.get('notas_cocina', '')
                )

                for opcion in opciones_a_guardar:
                    DetalleOrdenOpcion.objects.create(
                        detalle_orden=detalle,
                        opcion_variacion=opcion,
                        precio_adicional_aplicado=opcion.precio_adicional
                    )

                nuevo_total += precio_final_unitario * int(d['cantidad'])

            aplicar_reglas_negocio(orden)

            # 🎁 Canje de puntos (lo manda el bot): descuenta del saldo, registra y baja el total.
            puntos_canje = self.request.data.get('puntos_a_canjear')
            if puntos_canje:
                tel = (orden.cliente_telefono or '').strip()
                cliente_p = (Cliente.objects.filter(
                    negocio=orden.sede.negocio, telefono__icontains=tel[-9:]).first() if tel else None)
                p_uso, desc_p, err_p = _calcular_descuento_puntos(orden.sede.negocio, cliente_p, puntos_canje)
                if p_uso > 0 and not err_p:
                    cliente_p.puntos_acumulados = (cliente_p.puntos_acumulados or 0) - p_uso
                    cliente_p.save(update_fields=['puntos_acumulados'])
                    CanjePuntos.objects.create(
                        negocio=orden.sede.negocio, cliente=cliente_p, orden=orden,
                        puntos=p_uso, valor_soles=desc_p)
                    orden.descuento_total = (orden.descuento_total or Decimal('0')) + desc_p
                    orden.total = max(orden.total - desc_p, Decimal('0.00'))

            orden.save()

            # CRM + puntos por la compra del bot (mismo helper idempotente que el POS).
            acreditar_compra_cliente(orden)

        orden_data = self.get_serializer(orden).data
        channel_layer = get_channel_layer()

        async_to_sync(channel_layer.group_send)(
            f"cocina_sede_{orden.sede_id}",
            {"type": "orden_nueva", "orden": orden_data}
        )
        if orden.mesa_id:
            async_to_sync(channel_layer.group_send)(
                f"salon_sede_{orden.sede_id}",
                {"type": "mesa_actualizada", "mesa_id": orden.mesa_id, "estado": "ocupada", "total": float(orden.total)}
            )
        if orden.tipo == 'llevar':
            async_to_sync(channel_layer.group_send)(
                f"salon_sede_{orden.sede_id}",
                {"type": "orden_llevar_actualizada", "accion": "nueva", "orden": orden_data}
            )

    def perform_update(self, serializer):
        instance = serializer.save()
        channel_layer = get_channel_layer()
        estados_libres = {'completado', 'cancelado'}

        if instance.estado in estados_libres or instance.estado_pago == 'pagado':
            if instance.mesa_id:
                async_to_sync(channel_layer.group_send)(
                    f"salon_sede_{instance.sede_id}",
                    {"type": "mesa_actualizada", "mesa_id": instance.mesa_id, "estado": "libre", "total": 0}
                )
            if instance.tipo == 'llevar':
                orden_data = self.get_serializer(instance).data
                accion = 'completada' if instance.estado in estados_libres or instance.estado_pago == 'pagado' else 'actualizada'
                async_to_sync(channel_layer.group_send)(
                    f"salon_sede_{instance.sede_id}",
                    {"type": "orden_llevar_actualizada", "accion": accion, "orden": orden_data}
                )

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def cotizar_bot(self, request):
        """
        Calcula el total REAL de un pedido (subtotal + happy hours + reglas de negocio
        + recargos/descuentos por método y tipo + envío) SIN crear la orden.
        Lo usa el bot de WhatsApp para cotizarle al cliente EXACTAMENTE lo que se cobrará,
        en vez de que la IA sume precios por su cuenta (y se equivoque con las reglas).
        Body: { sede, tipo, metodo_pago_esperado, costo_envio, detalles:[{producto,cantidad,opciones}] }
        """
        sede_id = request.data.get('sede')
        tipo = request.data.get('tipo') or 'salon'
        metodo = request.data.get('metodo_pago_esperado') or ''
        try:
            costo_envio = Decimal(str(request.data.get('costo_envio') or 0))
        except Exception:
            costo_envio = Decimal('0')
        detalles_data = request.data.get('detalles') or []

        negocio = getattr(request.user, 'negocio', None)
        filtro = {'id': sede_id}
        if negocio:
            filtro['negocio'] = negocio
        sede = Sede.objects.filter(**filtro).first()
        if not sede:
            return Response({'error': 'Sede no encontrada.'}, status=status.HTTP_400_BAD_REQUEST)
        if not detalles_data:
            return Response({'error': 'No hay productos para cotizar.'}, status=status.HTTP_400_BAD_REQUEST)

        # 🛵 Si es delivery y mandan coordenadas, el BACKEND calcula el envío desde la zona
        # (la IA no decide el costo; solo pasa lat/lng de la ubicación del cliente).
        lat = request.data.get('latitud')
        lon = request.data.get('longitud')
        if tipo == 'delivery' and lat not in (None, '') and lon not in (None, '') and sede.latitud and sede.longitud:
            from .cliente_views import calcular_distancia_km
            from ..models import ZonaDelivery
            try:
                dist = calcular_distancia_km(float(sede.latitud), float(sede.longitud), float(lat), float(lon)) * 1.5
                zona = (ZonaDelivery.objects
                        .filter(sede=sede, activa=True, radio_max_km__gte=dist)
                        .order_by('radio_max_km').first())
                if zona:
                    costo_envio = Decimal(str(zona.costo_envio))
                else:
                    return Response({
                        'error': f'Fuera de cobertura (a ~{round(dist, 1)} km). Un humano validará el envío.',
                        'fuera_de_rango': True,
                    }, status=status.HTTP_200_OK)
            except (TypeError, ValueError):
                pass

        # Creamos la orden y sus detalles en un savepoint y lo revertimos:
        # así reutilizamos EXACTAMENTE la misma lógica de precios que al cobrar,
        # sin persistir nada (no hay señales post_save en Orden/DetalleOrden).
        sid = transaction.savepoint()
        try:
            orden = Orden.objects.create(
                sede=sede, tipo=tipo, estado='preparando',
                metodo_pago_esperado=metodo, costo_envio=costo_envio,
            )
            lineas = []
            for d in detalles_data:
                try:
                    producto = Producto.objects.get(id=d.get('producto'))
                except Producto.DoesNotExist:
                    continue
                cantidad = int(d.get('cantidad') or 1)
                opciones_raw = d.get('opciones') or d.get('opciones_seleccionadas') or []
                opciones_a_guardar, subtotal_opciones = _procesar_opciones(opciones_raw, {})
                precio_unit = producto.precio_base + subtotal_opciones
                det = DetalleOrden.objects.create(
                    orden=orden, producto=producto, cantidad=cantidad, precio_unitario=precio_unit,
                )
                for opc in opciones_a_guardar:
                    DetalleOrdenOpcion.objects.create(
                        detalle_orden=det, opcion_variacion=opc,
                        precio_adicional_aplicado=opc.precio_adicional,
                    )
                lineas.append({
                    'producto': producto.nombre,
                    'cantidad': cantidad,
                    'precio_unitario': float(precio_unit),
                    'total_linea': float(precio_unit * cantidad),
                })

            orden.refresh_from_db()
            aplicar_reglas_negocio(orden, metodo_pago=metodo)

            # 🎁 Previsualización del canje de puntos (no descuenta; eso es al crear la orden)
            telefono = (request.data.get('telefono') or '').strip()
            cliente = (Cliente.objects.filter(negocio=sede.negocio, telefono__icontains=telefono[-9:]).first()
                       if telefono else None)
            p_uso, desc_puntos, err_puntos = _calcular_descuento_puntos(
                sede.negocio, cliente, request.data.get('puntos_a_canjear'))
            total_final = max(orden.total - desc_puntos, Decimal('0.00'))

            resumen = f"Subtotal: S/ {orden.subtotal:.2f}"
            if orden.descuento_total:
                resumen += f" | Descuento: -S/ {orden.descuento_total:.2f}"
            if orden.recargo_total:
                resumen += f" | Recargo: +S/ {orden.recargo_total:.2f}"
            if orden.costo_envio:
                resumen += f" | Envío: +S/ {orden.costo_envio:.2f}"
            if desc_puntos:
                resumen += f" | Canje {p_uso} pts: -S/ {desc_puntos:.2f}"
            resumen += f" | TOTAL A PAGAR: S/ {total_final:.2f}"

            resultado = {
                'subtotal': float(orden.subtotal),
                'descuento_total': float(orden.descuento_total),
                'recargo_total': float(orden.recargo_total),
                'costo_envio': float(orden.costo_envio),
                'descuento_puntos': float(desc_puntos),
                'puntos_canjeados': p_uso,
                'total': float(total_final),
                'lineas': lineas,
                'resumen': resumen,
            }
            if err_puntos:
                resultado['aviso_puntos'] = err_puntos
        finally:
            transaction.savepoint_rollback(sid)

        return Response(resultado)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def pedido_habitual_bot(self, request):
        """
        Devuelve los productos que el cliente pide más seguido (su 'pedido de siempre'),
        para que el bot le sugiera repetir. Param: telefono.
        """
        negocio = getattr(request.user, 'negocio', None)
        telefono = (request.query_params.get('telefono') or '').strip()
        if negocio is None or not telefono:
            return Response({'tiene_historial': False})

        sufijo = telefono[-9:]
        frecuentes = (DetalleOrden.objects
                      .filter(orden__sede__negocio=negocio, orden__cliente_telefono__icontains=sufijo)
                      .exclude(orden__estado='cancelado')
                      .values('producto_id', 'producto__nombre')
                      .annotate(veces=Count('id'), total_cant=Sum('cantidad'))
                      .order_by('-veces', '-total_cant')[:5])
        if not frecuentes:
            return Response({'tiene_historial': False})

        return Response({
            'tiene_historial': True,
            'productos_frecuentes': [
                {'producto': f['producto_id'], 'nombre': f['producto__nombre'], 'veces': f['veces']}
                for f in frecuentes
            ],
        })

    @action(detail=True, methods=['post'])
    def agregar_productos(self, request, pk=None):
        orden = self.get_object()

        if orden.estado == 'cancelado' or orden.estado_pago == 'pagado':
            return Response(
                {'error': 'No se pueden agregar productos a una orden cerrada o pagada.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        detalles_data = request.data.get('detalles', [])
        detalles_creados = []

        with transaction.atomic():
            for detalle_data in detalles_data:
                producto = Producto.objects.get(id=detalle_data['producto'])
                precio_seguro = producto.precio_base

                notas = detalle_data.get('notas_y_modificadores', {})
                if isinstance(notas, str):
                    try:
                        notas = json.loads(notas) if notas.strip() else {}
                    except Exception:
                        notas = {}

                variaciones_dict = notas.get('variaciones', {})
                opciones_ids_raw = detalle_data.get('opciones_seleccionadas', [])
                opciones_a_guardar, subtotal_opciones = _procesar_opciones(opciones_ids_raw, variaciones_dict)
                precio_final_unitario = precio_seguro + subtotal_opciones

                nuevo_detalle = DetalleOrden.objects.create(
                    orden=orden,
                    producto=producto,
                    cantidad=detalle_data['cantidad'],
                    precio_unitario=precio_final_unitario,
                    notas_y_modificadores=notas,
                    notas_cocina=detalle_data.get('notas_cocina', '')
                )
                detalles_creados.append(nuevo_detalle)

                for opcion in opciones_a_guardar:
                    DetalleOrdenOpcion.objects.create(
                        detalle_orden=nuevo_detalle,
                        opcion_variacion=opcion,
                        precio_adicional_aplicado=opcion.precio_adicional
                    )

            orden.refresh_from_db()
            aplicar_reglas_negocio(orden)
            orden.save()

        nuevos_detalles_json = DetalleOrdenSerializer(detalles_creados, many=True).data
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"cocina_sede_{orden.sede_id}",
            {
                "type": "orden_nueva",
                "orden": {
                    "id": orden.id,
                    "es_actualizacion": True,
                    "mesa": f"{orden.mesa.numero_o_nombre} (AGREGADO)" if orden.mesa else "LLEVAR (AGREGADO)",
                    "detalles": nuevos_detalles_json
                }
            }
        )

        orden_fresca = Orden.objects.prefetch_related(
            'detalles__producto', 'detalles__opciones_seleccionadas'
        ).get(id=orden.id)

        if orden.mesa_id:
            async_to_sync(channel_layer.group_send)(
                f"salon_sede_{orden.sede_id}",
                {"type": "mesa_actualizada", "mesa_id": orden.mesa_id, "estado": "ocupada", "total": float(orden_fresca.total)}
            )

        return Response({
            'status': 'Productos agregados correctamente',
            'orden': self.get_serializer(orden_fresca).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def anular_item(self, request, pk=None):
        orden = self.get_object()
        detalle_id = request.data.get('detalle_id')
        motivo = request.data.get('motivo', 'No especificado')

        empleado = get_empleado_desde_header(request)
        empleado_nombre = empleado.nombre if empleado else request.user.username or 'Admin'

        try:
            with transaction.atomic():
                detalle = orden.detalles.get(id=detalle_id)
                nombre_plato = detalle.producto.nombre

                RegistroAuditoria.objects.create(
                    sede=orden.sede,
                    empleado_nombre=empleado_nombre,
                    accion='anular_plato',
                    descripcion=f"Anuló {detalle.cantidad}x {nombre_plato} de Orden #{orden.id}. Motivo: {motivo}"
                )

                detalle.delete()
                aplicar_reglas_negocio(orden)
                orden.save()

            orden_fresca = Orden.objects.prefetch_related(
                'detalles__producto', 'detalles__opciones_seleccionadas'
            ).get(id=orden.id)
            return Response({
                'status': 'Plato anulado y auditado',
                'orden': self.get_serializer(orden_fresca).data
            }, status=status.HTTP_200_OK)

        except DetalleOrden.DoesNotExist:
            return Response({'error': 'El plato no existe'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cobrar_orden(self, request, pk=None):
        """
        Endpoint de cobro y CRM.
        Soporta dos flujos:
          - Pago normal (efectivo, tarjeta, manual)
          - Pago ya confirmado por WebSocket (Yape/Plin automático)
        """
        # 🛡️ RBAC
        empleado_rbac = get_empleado_verificado(request)
        if empleado_rbac and (not empleado_rbac.rol or not empleado_rbac.rol.puede_cobrar):
            return Response(
                {'error': 'Tu rol no tiene permiso para cobrar órdenes.'},
                status=status.HTTP_403_FORBIDDEN
            )

        orden = self.get_object()

        pagos_data      = request.data.get('pagos', [])
        telefono_crm    = request.data.get('telefono', '').strip()
        sesion_caja_id  = request.data.get('sesion_caja_id')

        # ✅ Si la orden ya fue pagada por WebSocket, solo procesamos
        # CRM y WebSockets sin intentar crear pagos duplicados.
        ya_pagada = orden.estado_pago == 'pagado'

        try:
            with transaction.atomic():
                sesion_caja = SesionCaja.objects.get(id=sesion_caja_id) if sesion_caja_id else None

                if not ya_pagada:
                    # ── Flujo normal: registrar pagos ──────────────────
                    # Cancela los pagos manuales de un intento de cobro anterior (ej. el
                    # cajero corrigió el monto), sin tocar los ya confirmados por la app
                    # de Yape/Plin (notificacion_origen) — esos deben sobrevivir al reintento.
                    Pago.objects.filter(
                        orden=orden, estado='confirmado', notificacion_origen__isnull=True
                    ).update(estado='cancelado')

                    for p in pagos_data:
                        monto_pago  = Decimal(str(p.get('monto', '0.00')))
                        metodo_pago = p.get('metodo', 'efectivo')
                        if monto_pago > 0:
                            # Evitar duplicar si ya existe un pago confirmado
                            # por la app Android (notificacion_origen distinto de null)
                            ya_confirmado_ws = Pago.objects.filter(
                                orden=orden,
                                metodo=metodo_pago,
                                estado='confirmado',
                                notificacion_origen__isnull=False,
                            ).exists()

                            if not ya_confirmado_ws:
                                Pago.objects.create(
                                    orden=orden,
                                    metodo=metodo_pago,
                                    monto=monto_pago,
                                    sesion_caja=sesion_caja
                                )

                    # Re-aplicar reglas con el método dominante
                    metodo_dominante = (
                        max(pagos_data, key=lambda p: float(p.get('monto', 0)), default={})
                        .get('metodo', '')
                        if pagos_data else ''
                    )
                    aplicar_reglas_negocio(orden, metodo_pago=metodo_dominante)
                    orden.save()

                    total_cubierto = (
                        Pago.objects.filter(orden=orden)
                        .aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00')
                    )

                    if total_cubierto >= orden.total:
                        orden.estado_pago = 'pagado'
                        if orden.estado != 'cancelado':
                            orden.estado = 'completado'

                else:
                    # ── Pago ya confirmado por WebSocket ───────────────
                    # Solo completamos el estado de cocina si corresponde
                    if orden.estado != 'cancelado':
                        orden.estado = 'completado'
                    total_cubierto = (
                        Pago.objects.filter(orden=orden)
                        .aggregate(Sum('monto'))['monto__sum'] or Decimal('0.00')
                    )

                # ── CRM + puntos — SIEMPRE se ejecuta (no depende de
                #    mod_clientes_activo ni de puntos_activo; ese flag solo controla
                #    que el bot mencione/permita canjear). ────────────────────────
                telefono_norm = _normalizar_telefono(telefono_crm)
                if len(telefono_norm) >= 9:
                    orden.cliente_telefono = telefono_norm
                acreditar_compra_cliente(orden)

                orden.save()

            # ── WebSockets — siempre se ejecuta ───────────────────────
            channel_layer = get_channel_layer()
            if orden.mesa_id and orden.estado_pago == 'pagado':
                async_to_sync(channel_layer.group_send)(
                    f"salon_sede_{orden.sede_id}",
                    {"type": "mesa_actualizada", "mesa_id": orden.mesa_id, "estado": "libre", "total": 0}
                )
            if orden.tipo == 'llevar' and orden.estado_pago == 'pagado':
                orden_data = self.get_serializer(orden).data
                async_to_sync(channel_layer.group_send)(
                    f"salon_sede_{orden.sede_id}",
                    {"type": "orden_llevar_actualizada", "accion": "completada", "orden": orden_data}
                )

            return Response({
                'status': 'Cobro exitoso',
                'total_pagado': float(total_cubierto),
                'crm_actualizado': bool(telefono_crm)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error procesando cobro de orden {orden.id}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error interno al procesar el pago.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def preview_cobro(self, request, pk=None):
        orden = self.get_object()
        metodo_pago = request.data.get('metodo', '')
        aplicar_reglas_negocio(orden, metodo_pago=metodo_pago)
        lineas_hh = calcular_preview_happy_hours(orden)
        return Response({
            'subtotal':          float(orden.subtotal),
            'descuento_total':   float(orden.descuento_total),
            'recargo_total':     float(orden.recargo_total),
            'total':             float(orden.total),
            'metodo':            metodo_pago,
            'lineas_happy_hour': lineas_hh,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def estado_orden_bot(self, request):
        sede_id  = request.query_params.get('sede_id')
        telefono = request.query_params.get('telefono')

        if not sede_id or not telefono:
            return Response({"error": "Se requiere sede_id y telefono."}, status=400)

        try:
            orden = Orden.objects.prefetch_related(
                'detalles__producto', 'detalles__opciones_seleccionadas'
            ).filter(
                sede_id=sede_id,
                cliente_telefono=telefono
            ).exclude(
                estado__in=['cancelado', 'completado']
            ).order_by('-creado_en').first()

            if not orden:
                return Response({'orden': None})

            return Response({'orden': self.get_serializer(orden).data})

        except Exception as e:
            logger.error("Error en estado_orden_bot para sede %s telefono %s", sede_id, telefono, exc_info=True)
            return Response({"error": "Ocurrió un error interno en el servidor."}, status=500)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def modificar_desde_bot(self, request, pk=None):
        try:
            orden = Orden.objects.get(id=pk)
        except Orden.DoesNotExist:
            return Response({"error": f"La orden {pk} no existe."}, status=404)

        accion = request.data.get('accion')
        datos  = request.data.get('datos', {})

        if orden.estado in ['listo', 'completado']:
            return Response({
                "status": "rechazado",
                "mensaje": "¡Uf! Casi. Pero tu pedido ya salió de la cocina o fue entregado. Ya no puedo modificarlo. 🛵"
            }, status=status.HTTP_400_BAD_REQUEST)

        if orden.estado == 'pendiente':
            with transaction.atomic():
                if accion == 'cancelar':
                    orden.estado = 'cancelado'
                    orden.motivo_cancelacion = "Cancelado por el cliente vía WhatsApp"
                    orden.save()
                    return Response({"status": "aprobado", "mensaje": "Pedido cancelado con éxito. ¡No hay problema! 👍"})

                elif accion == 'nota':
                    nota_nueva = datos.get('nota', '')
                    orden.notas_cocina = f"{orden.notas_cocina or ''} | BOT: {nota_nueva}"
                    orden.save()
                    return Response({"status": "aprobado", "mensaje": "¡Anotado! Ya le pasé el dato a la cocina. 📝"})

        if orden.estado == 'preparando':
            solicitud = SolicitudCambio.objects.create(
                orden=orden,
                tipo_accion=accion,
                detalles_json=datos
            )

            channel_layer = get_channel_layer()
            alerta = {
                "type": "solicitud_cambio_nueva",
                "solicitud_id": solicitud.id,
                "orden_id": orden.id,
                "mesa": orden.mesa.numero_o_nombre if orden.mesa else "Delivery",
                "accion": accion,
                "descripcion": f"El cliente quiere {accion}: {datos.get('nota', 'Sin detalles')}"
            }
            async_to_sync(channel_layer.group_send)(f"cocina_sede_{orden.sede_id}", alerta)
            async_to_sync(channel_layer.group_send)(f"salon_sede_{orden.sede_id}", alerta)

            return Response({
                "status": "en_revision",
                "mensaje": "Tu pedido ya se está preparando. 👨‍🍳 He enviado una alerta a la cocina para ver si aún llegamos a tiempo. ¡Dame un momento!"
            })

        return Response({"status": "error", "mensaje": "Acción no reconocida."}, status=400)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def resolver_solicitud_bot(self, request, pk=None):
        try:
            orden         = Orden.objects.get(id=pk)
            solicitud_id  = request.data.get('solicitud_id')
            decision      = request.data.get('decision')
            solicitud     = SolicitudCambio.objects.get(id=solicitud_id, orden=orden, estado='pendiente')
        except (Orden.DoesNotExist, SolicitudCambio.DoesNotExist):
            return Response({"error": "La orden o solicitud no existe."}, status=404)

        mensaje_whatsapp = ""

        with transaction.atomic():
            if decision == 'aprobar':
                solicitud.estado = 'aprobada'

                if solicitud.tipo_accion == 'cancelar':
                    orden.estado = 'cancelado'
                    orden.motivo_cancelacion = "Cancelado por solicitud del bot (Aprobado por staff)"
                    mensaje_whatsapp = "✅ ¡Listo! El encargado aprobó tu solicitud y hemos anulado el pedido. ¿Te puedo ayudar con algo más?"

                elif solicitud.tipo_accion == 'nota':
                    nota_extra = solicitud.detalles_json.get('nota', '')
                    orden.notas_cocina = f"{orden.notas_cocina or ''} | MODIFICACIÓN: {nota_extra}"
                    mensaje_whatsapp = "✅ ¡Anotado! La cocina confirmó que prepararán tu pedido con esa indicación especial."

                orden.save()
            else:
                solicitud.estado = 'rechazada'
                mensaje_whatsapp = "❌ Lo siento mucho, consulté con la cocina pero tu pedido ya está en la parrilla 🥩 y no podemos modificarlo en este punto."

            solicitud.save()

        if orden.sede.whatsapp_instancia and orden.cliente_telefono:
            numero_limpio = str(orden.cliente_telefono).strip()
            if not numero_limpio.startswith('51'):
                numero_limpio = f"51{numero_limpio}"

            url     = f"{settings.EVO_API_URL}/message/sendText/{orden.sede.whatsapp_instancia}"
            headers = {"apikey": settings.EVO_GLOBAL_KEY, "Content-Type": "application/json"}
            payload = {
                "number":  numero_limpio,
                "options": {"delay": 1200, "presence": "composing"},
                "text":    mensaje_whatsapp
            }

            try:
                response = requests.post(url, json=payload, headers=headers, timeout=5)
                if response.status_code not in (200, 201):
                    logger.error(f"Error de Evolution API: {response.text}")
            except Exception as e:
                logger.error(f"Error enviando mensaje Evo: {e}")

        return Response({"status": "resuelto", "decision": decision})


# ============================================================
# DETALLE ORDEN
# ============================================================

class DetalleOrdenViewSet(viewsets.ModelViewSet):
    serializer_class = DetalleOrdenSerializer

    def get_queryset(self):
        if self.request.user.is_superuser:
            return DetalleOrden.objects.all()
        if hasattr(self.request.user, 'negocio'):
            return DetalleOrden.objects.filter(orden__sede__negocio=self.request.user.negocio)
        return DetalleOrden.objects.none()


# ============================================================
# PAGO
# ============================================================

class PagoViewSet(viewsets.ModelViewSet):
    serializer_class = PagoSerializer

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Pago.objects.all()
        if hasattr(self.request.user, 'negocio'):
            return Pago.objects.filter(orden__sede__negocio=self.request.user.negocio)
        return Pago.objects.none()