import logging
import time as time_module

from django.core.cache import cache
from django.utils import timezone
from django.contrib.auth.hashers import check_password, make_password
from rest_framework import viewsets, status
from rest_framework.decorators import action, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from urllib3 import request

from .helpers import es_valor_nulo
from ..models import Rol, Empleado
from ..permissions import SoloLecturaSalvoSuperUsuario
from ..serializers import RolSerializer, EmpleadoSerializer

logger = logging.getLogger(__name__)


# ============================================================
# ROL
# ============================================================

class RolViewSet(viewsets.ModelViewSet):
    """
    Catálogo GLOBAL de roles (Cajero, Mesero, etc.), compartido por todos los
    negocios — no tiene FK a Negocio. Por eso el CRUD de escritura queda
    reservado al superusuario (Leybrak); cualquier negocio solo puede leerlo
    para armar el selector de rol al crear un empleado (ver Personal y Accesos).
    """
    serializer_class = RolSerializer
    permission_classes = [SoloLecturaSalvoSuperUsuario]

    def get_queryset(self):
        return Rol.objects.all()


# ============================================================
# EMPLEADO
# ============================================================

class PinRateThrottle(ScopedRateThrottle):
    scope = 'intentos_pin'


class EmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = EmpleadoSerializer

    def perform_create(self, serializer):
        if hasattr(self.request.user, 'negocio'):
            serializer.save(negocio=self.request.user.negocio)
        else:
            serializer.save()

    def get_queryset(self):
        queryset = Empleado.objects.all()
        empleado_solicitante_id = self.request.headers.get('X-Empleado-Id')

        if self.request.user.is_superuser:
            pass

        elif hasattr(self.request.user, 'negocio'):
            queryset = queryset.filter(negocio=self.request.user.negocio)

            sede_id = self.request.query_params.get('sede_id')
            negocio_id = self.request.query_params.get('negocio_id')
            if not es_valor_nulo(sede_id):
                queryset = queryset.filter(sede_id=sede_id)
            elif not es_valor_nulo(negocio_id):
                queryset = queryset.filter(negocio_id=negocio_id)

        elif empleado_solicitante_id:
            try:
                empleado_actual = Empleado.objects.select_related('rol').get(id=empleado_solicitante_id)
                queryset = queryset.filter(sede=empleado_actual.sede)
            except Empleado.DoesNotExist:
                return queryset.none()

        else:
            return queryset.none()

        if self.request.query_params.get('solo_activos') == 'true':
            queryset = queryset.filter(activo=True)

        return queryset

    @action(detail=False, methods=['POST'], permission_classes=[AllowAny], url_path='validar_pin')
    @throttle_classes([PinRateThrottle])
    def validar_pin(self, request):
        pin_ingresado = request.data.get('pin')
        sede_id = request.data.get('sede_id')
        accion = request.data.get('accion')

        if not pin_ingresado or not sede_id:
            return Response({'error': 'PIN y sede_id son obligatorios'}, status=status.HTTP_400_BAD_REQUEST)

        # 🛡️ LOCKOUT BACKEND: Verificar si esta tablet/sede está bloqueada
        lock_key  = f"pin_locked_{sede_id}"
        fail_key  = f"pin_fails_{sede_id}"
        MAX_FAILS = 5
        LOCKOUT_S = 120  # 2 minutos

        lockout_until = cache.get(lock_key)
        if lockout_until:
            remaining = int(lockout_until - time_module.time())
            if remaining > 0:
                return Response(
                    {'error': f'Tablet bloqueada por intentos fallidos. Espera {remaining} segundos.',
                     'segundos_restantes': remaining},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )
            # El bloqueo expiró — limpiar
            cache.delete(lock_key)
            cache.delete(fail_key)

        empleados = Empleado.objects.filter(sede_id=sede_id, activo=True)
        empleado_valido = None

        for emp in empleados:
            pin_stored = emp.pin
            es_plano = not pin_stored.startswith(('pbkdf2_', 'argon2', 'bcrypt', '!'))

            if es_plano:
                if pin_stored == pin_ingresado:
                    emp.pin = make_password(pin_ingresado)
                    emp.save(update_fields=['pin'])
                    empleado_valido = emp
                    break
                continue

            if check_password(pin_ingresado, pin_stored):
                empleado_valido = emp
                break

        if not empleado_valido:
            # Incrementar contador de fallos
            fails = cache.get(fail_key, 0) + 1
            cache.set(fail_key, fails, timeout=300)  # Ventana de 5 min

            if fails >= MAX_FAILS:
                cache.set(lock_key, time_module.time() + LOCKOUT_S, timeout=LOCKOUT_S + 10)
                cache.delete(fail_key)
                return Response(
                    {'error': f'Demasiados intentos fallidos. Tablet bloqueada por {LOCKOUT_S // 60} minutos.',
                     'segundos_restantes': LOCKOUT_S},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

            intentos_restantes = MAX_FAILS - fails
            return Response(
                {'error': f'PIN incorrecto. Intentos restantes: {intentos_restantes}.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # ✅ Éxito: limpiar contadores de fallo
        cache.delete(fail_key)
        cache.delete(lock_key)

        if accion == 'asistencia':
            empleado_valido.ultimo_ingreso = timezone.now()
            empleado_valido.save(update_fields=['ultimo_ingreso'])

        return Response({
            'id': empleado_valido.id,
            'nombre': empleado_valido.nombre,
            'rol_nombre': empleado_valido.rol.nombre if empleado_valido.rol else 'Sin Rol',
        }, status=status.HTTP_200_OK)
    

    @action(detail=False, methods=['GET'], url_path='rendimiento')
    def rendimiento(self, request):
        from django.db.models import Sum, Q
        from django.utils import timezone
        from ..models import Orden, Pago
        import datetime

        hoy = timezone.now()
        mes = int(request.query_params.get('mes', hoy.month))
        anio = int(request.query_params.get('anio', hoy.year))
        sede_id = request.query_params.get('sede_id')

        # Rango del mes
        inicio = timezone.make_aware(datetime.datetime(anio, mes, 1))
        fin = timezone.make_aware(
            datetime.datetime(anio + 1, 1, 1) if mes == 12
            else datetime.datetime(anio, mes + 1, 1)
        )

        empleados_qs = self.get_queryset()
        if sede_id:
            empleados_qs = empleados_qs.filter(sede_id=sede_id)

        ordenes_base_q = Q(
            creado_en__gte=inicio,
            creado_en__lt=fin,
            estado='completado',
            estado_pago='pagado',
        )
        if sede_id:
            ordenes_base_q &= Q(sede_id=sede_id)

        resultado = []
        for emp in empleados_qs:
            ordenes = Orden.objects.filter(ordenes_base_q, mesero=emp)
            total_ordenes = ordenes.count()
            total_ingresos = Pago.objects.filter(
                orden__in=ordenes
            ).aggregate(total=Sum('monto'))['total'] or 0

            resultado.append({
                'id': emp.id,
                'nombre': emp.nombre,
                'rol': emp.rol.nombre if emp.rol else 'Sin Rol',
                'sede': emp.sede.nombre if emp.sede else '-',
                'total_ordenes': total_ordenes,
                'total_ingresos': float(total_ingresos),
                'ultimo_ingreso': emp.ultimo_ingreso,
            })

        resultado.sort(key=lambda x: x['total_ingresos'], reverse=True)

        return Response({
            'mes': mes,
            'anio': anio,
            'rendimiento': resultado,
        })

# ============================================================
# ESTADO DE BLOQUEO PIN (público)
# ============================================================
from rest_framework.decorators import api_view

@api_view(['GET'])
@permission_classes([AllowAny])
def estado_bloqueo_pin(request):
    sede_id = request.query_params.get('sede_id')
    if not sede_id:
        return Response({'bloqueado': False, 'segundos_restantes': 0})

    lock_key = f"pin_locked_{sede_id}"
    lockout_until = cache.get(lock_key)

    if lockout_until:
        remaining = int(lockout_until - time_module.time())
        if remaining > 0:
            return Response({'bloqueado': True, 'segundos_restantes': remaining})
        cache.delete(lock_key)

    return Response({'bloqueado': False, 'segundos_restantes': 0})
