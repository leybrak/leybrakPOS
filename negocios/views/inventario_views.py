import logging

from django.db import transaction
from django.db.models import F
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import InsumoBase, InsumoSede, Sede
from ..serializers import InsumoBaseSerializer, InsumoSedeSerializer

logger = logging.getLogger(__name__)


# ============================================================
# INSUMOS
# ============================================================

class InsumoBaseViewSet(viewsets.ModelViewSet):
    serializer_class = InsumoBaseSerializer

    def get_queryset(self):
        if self.request.user.is_superuser:
            return InsumoBase.objects.all()
        if hasattr(self.request.user, 'negocio'):
            return InsumoBase.objects.filter(negocio=self.request.user.negocio)
        return InsumoBase.objects.none()


class InsumoSedeViewSet(viewsets.ModelViewSet):
    serializer_class = InsumoSedeSerializer

    def get_queryset(self):
        sede_id = self.request.query_params.get('sede_id')
        if not sede_id:
            return InsumoSede.objects.none()
        if self.request.user.is_superuser:
            return InsumoSede.objects.filter(sede_id=sede_id)
        if hasattr(self.request.user, 'negocio'):
            return InsumoSede.objects.filter(sede_id=sede_id, sede__negocio=self.request.user.negocio)
        return InsumoSede.objects.none()

    @action(detail=False, methods=['post'])
    def ingreso_masivo(self, request):
        try:
            insumo_base_id = request.data.get('insumo_base_id')
            if not insumo_base_id:
                return Response({"error": "Falta el ID del insumo."}, status=400)

            insumo_base = InsumoBase.objects.get(id=insumo_base_id)

            if not request.user.is_superuser:
                if not hasattr(request.user, 'negocio') or insumo_base.negocio != request.user.negocio:
                    return Response({'error': 'No autorizado'}, status=403)

            stock_actual_matriz     = float(insumo_base.stock_general)
            nuevo_ingreso           = float(request.data.get('ingreso_global', 0) or 0)
            stock_proyectado_matriz = stock_actual_matriz + nuevo_ingreso

            distribucion     = request.data.get('distribucion', {})
            total_a_repartir = sum(float(v) for v in distribucion.values() if v and float(v) > 0)

            # 🛡️ Sin esto, se podía repartir stock a una sede de OTRO negocio
            # (id de sede adivinado), ensuciando su inventario con datos ajenos.
            sede_ids = [int(sid) for sid in distribucion.keys()]
            if sede_ids and Sede.objects.filter(
                id__in=sede_ids, negocio=insumo_base.negocio
            ).count() != len(set(sede_ids)):
                return Response({'error': 'Una de las sedes indicadas no pertenece a tu negocio.'}, status=403)

            if total_a_repartir > stock_proyectado_matriz:
                raise ValueError(
                    f"No hay suficiente stock. Quieres repartir {total_a_repartir}, "
                    f"pero solo tendrás {stock_proyectado_matriz} en Matriz."
                )

            with transaction.atomic():
                insumo_base.stock_general = stock_proyectado_matriz - total_a_repartir
                insumo_base.save()

                for sede_id_str, cantidad in distribucion.items():
                    cant_float = float(cantidad) if cantidad else 0.0
                    if cant_float > 0:
                        obj, _ = InsumoSede.objects.get_or_create(
                            insumo_base=insumo_base,
                            sede_id=int(sede_id_str),
                            defaults={'stock_actual': 0, 'stock_minimo': 5, 'costo_unitario': 0}
                        )
                        InsumoSede.objects.filter(id=obj.id).update(
                            stock_actual=F('stock_actual') + cant_float
                        )

            return Response({"mensaje": "Operación logística completada."})

        except InsumoBase.DoesNotExist:
            return Response({"error": "El insumo maestro no existe."}, status=400)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            logger.error("Error en ingreso_masivo para insumo %s", insumo_base_id, exc_info=True)
            return Response({"error": "Ocurrió un error interno en el servidor."}, status=500)

    @action(detail=False, methods=['get'])
    def alertas_bajo_stock(self, request):
        """Insumos con stock_actual <= stock_minimo, para armar un pedido sugerido."""
        if not hasattr(request.user, 'negocio'):
            return Response([])
        qs = InsumoSede.objects.filter(
            sede__negocio=request.user.negocio,
            stock_actual__lte=F('stock_minimo'),
        ).select_related('insumo_base', 'sede')
        sede_id = request.query_params.get('sede_id')
        if sede_id:
            qs = qs.filter(sede_id=sede_id)
        return Response(InsumoSedeSerializer(qs, many=True).data)


# ============================================================
# FUNCIÓN AUXILIAR DE INVENTARIO
# ============================================================

def registrar_ingreso_maestro(insumo_base_id, reparticion):
    """
    reparticion = { sede_id: cantidad, ... }
    """
    insumo_base = InsumoBase.objects.get(id=insumo_base_id)
    for sede_id, cantidad in reparticion.items():
        obj, _ = InsumoSede.objects.get_or_create(
            insumo_base=insumo_base,
            sede_id=sede_id,
            defaults={'stock_actual': 0, 'stock_minimo': 5}
        )
        InsumoSede.objects.filter(id=obj.id).update(
            stock_actual=F('stock_actual') + cantidad
        )
