from django.core.cache import cache
import logging
import secrets
import time as time_module
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken

from core import settings

from ..models import Sede, Producto, Categoria, Orden
from ..serializers import ProductoSerializer, CategoriaSerializer, OrdenSerializer

logger = logging.getLogger(__name__)


# ============================================================
# 🩺 HEALTHCHECK (público — usado por GitHub Actions)
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return JsonResponse({"status": "ok", "message": "Backend operando correctamente"})


# ============================================================
# ENDPOINTS PÚBLICOS (sin token — carta QR)
# ============================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def menu_publico(request, sede_id):
    try:
        sede = Sede.objects.get(id=sede_id)
        productos = Producto.objects.filter(
            negocio=sede.negocio, activo=True, disponible=True
        ).select_related('categoria').prefetch_related('grupos_variacion__opciones')

        categorias_ids = list(productos.values_list('categoria', flat=True).distinct())
        categorias = Categoria.objects.filter(id__in=categorias_ids)

        carta_config = sede.negocio.carta_config or {}

        # ── FIX NOMBRE ──────────────────────────────────────────────────────
        # Si carta_config tiene nombreNegocio vacío o ausente, usamos el nombre
        # real del negocio en la BD. Así el editor puede sobreescribirlo solo
        # cuando tenga un valor real, no un string vacío.
        nombre_bd = sede.negocio.nombre or ''
        nombre_config = (carta_config.get('nombreNegocio') or '').strip()
        nombre_final = nombre_bd

        # ── FIX IMÁGENES ─────────────────────────────────────────────────────
        # Pasamos context={'request': request} para que ImageField construya
        # la URL absoluta: http://localhost:8000/media/productos/fotos/...
        # Sin este context, DRF devuelve solo la ruta relativa.
        serializer_context = {'request': request}

        return Response({
            'negocio_nombre': nombre_final,
            'carta_config': {
                **carta_config,
                'nombreNegocio': nombre_final,   # siempre viene con valor real
            },
            'productos': ProductoSerializer(
                productos, many=True, context=serializer_context
            ).data,
            'categorias': CategoriaSerializer(categorias, many=True).data,
        })

    except Sede.DoesNotExist:
        return Response({'error': 'Sede no encontrada'}, status=404)
    except Exception as e:
        logger.error("Error en menu_publico para sede %s", sede_id, exc_info=True)
        return Response({"error": "Ocurrió un error interno en el servidor."}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def orden_publica(request, sede_id, mesa_id):
    try:
        orden = Orden.objects.prefetch_related(
            'detalles__producto', 'detalles__opciones_seleccionadas'
        ).filter(
            sede_id=sede_id,
            mesa_id=mesa_id,
            estado_pago='pendiente'
        ).exclude(estado__in=['cancelado', 'completado']).first()

        if not orden:
            return Response({'orden': None})
        return Response({'orden': OrdenSerializer(orden).data})

    except Exception as e:
        logger.error(
            "Error en orden_publica para sede %s mesa %s", sede_id, mesa_id, exc_info=True
        )
        return Response({"error": "Ocurrió un error interno en el servidor."}, status=500)


# ============================================================
# AUTH
# ============================================================

# publico_views.py
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verificar_sesion(request):
    user = request.user
    ws_token = AccessToken.for_user(user)

    # Determinar rol real desde la BD, no desde localStorage
    if user.is_superuser:
        rol = 'SuperAdmin'
    elif hasattr(user, 'negocio'):
        rol = 'Dueño'
    else:
        rol = 'Admin'  # usuario Django sin negocio

    negocio = getattr(user, 'negocio', None)
    nombre_perfil = (negocio.nombre_propietario if negocio else '') or user.get_full_name() or user.username
    avatar_url = None
    if negocio and negocio.avatar_propietario:
        avatar_url = request.build_absolute_uri(negocio.avatar_propietario.url)

    return Response({
        'autenticado': True,
        'ws_token': str(ws_token),
        'user': {
            'username': user.username,
            'rol': rol,
            'nombre': nombre_perfil,
            'avatar': avatar_url,
            # negocio_id para que el frontend sepa a qué negocio pertenece
            'negocio_id': negocio.id if negocio else None,
        }
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def login_empleado_pin(request):
    """
    Valida el PIN y genera un token de sesión de empleado
    guardado en cache (Redis), devuelto como cookie HttpOnly.
    """
    pin = request.data.get('pin')
    sede_id = request.data.get('sede_id')
    accion = request.data.get('accion', 'entrar')

    if not pin or not sede_id:
        return Response({'error': 'PIN y sede_id son requeridos'}, status=400)

    # Reutilizar tu lógica existente de lockout y validación de PIN
    lock_key = f"pin_locked_{sede_id}"
    fail_key = f"pin_fails_{sede_id}"
    MAX_FAILS = 5
    LOCKOUT_S = 120

    lockout_until = cache.get(lock_key)
    if lockout_until:
        remaining = int(lockout_until - time_module.time())
        if remaining > 0:
            return Response({
                'error': f'Terminal bloqueada. Espera {remaining} segundos.',
                'segundos_restantes': remaining
            }, status=429)
        cache.delete(lock_key)
        cache.delete(fail_key)
    from django.utils import timezone
    from ..models import Empleado, SesionCaja
    from django.contrib.auth.hashers import check_password, make_password
    
    empleados = Empleado.objects.filter(sede_id=sede_id, activo=True).select_related('rol')
    empleado_valido = None

    for emp in empleados:
        pin_stored = emp.pin
        es_plano = not pin_stored.startswith(('pbkdf2_', 'argon2', 'bcrypt', '!'))
        if es_plano:
            if pin_stored == pin:
                emp.pin = make_password(pin)
                emp.save(update_fields=['pin'])
                empleado_valido = emp
                break
        elif check_password(pin, pin_stored):
            empleado_valido = emp
            break

    if not empleado_valido:
        fails = cache.get(fail_key, 0) + 1
        cache.set(fail_key, fails, timeout=300)
        if fails >= MAX_FAILS:
            cache.set(lock_key, time_module.time() + LOCKOUT_S, timeout=LOCKOUT_S + 10)
            cache.delete(fail_key)
            return Response({'error': f'Terminal bloqueada por {LOCKOUT_S // 60} minutos.'}, status=429)
        return Response({'error': f'PIN incorrecto. Intentos restantes: {MAX_FAILS - fails}.'}, status=401)

    # 🔒 Gate de caja: sin sesión de caja abierta no se trabaja. Quien NO puede abrir
    # caja (mesero, cocinero, motorizado…) queda bloqueado hasta que el encargado la
    # abra. El cajero/admin/dueño sí puede entrar (para abrirla). El dueño que entra por
    # el ERP no pasa por acá.
    ROLES_CAJA = {'cajero', 'administrador', 'admin', 'dueño', 'dueno', 'gerente', 'encargado'}
    rol_nombre = (empleado_valido.rol.nombre if empleado_valido.rol else '').strip().lower()
    puede_abrir_caja = rol_nombre in ROLES_CAJA
    caja_abierta = SesionCaja.objects.filter(sede_id=sede_id, estado='abierta').exists()
    if not caja_abierta and not puede_abrir_caja:
        return Response({
            'error': 'La caja está cerrada. Pídele al encargado que abra la caja antes de ingresar.',
            'caja_cerrada': True,
        }, status=403)

    # ✅ PIN válido — generar token de sesión de empleado
    cache.delete(fail_key)
    cache.delete(lock_key)

    # Token único por sesión, guardado en Redis con TTL de 12 horas
    session_token = secrets.token_hex(32)
    session_key = f"empleado_session_{session_token}"
    puede_repartir = bool(empleado_valido.rol and empleado_valido.rol.puede_repartir)
    session_data = {
        'empleado_id': empleado_valido.id,
        'nombre': empleado_valido.nombre,
        'rol': empleado_valido.rol.nombre if empleado_valido.rol else 'Empleado',
        'puede_repartir': puede_repartir,
        'sede_id': sede_id,
        'negocio_id': str(empleado_valido.negocio_id),
    }
    cache.set(session_key, session_data, timeout=60 * 60 * 12)  # 12 horas

    if accion == 'asistencia':
        from django.utils import timezone
        empleado_valido.ultimo_ingreso = timezone.now()
        empleado_valido.save(update_fields=['ultimo_ingreso'])

    response = Response({
        'id': empleado_valido.id,                 # ← lo necesita el header X-Empleado-ID
        'nombre': empleado_valido.nombre,
        'rol': empleado_valido.rol.nombre if empleado_valido.rol else 'Empleado',
        'puede_repartir': puede_repartir,         # ← rutea al repartidor a su app dedicada
        'caja_abierta': caja_abierta,
        'sede_id': sede_id,
    })
    # Cookie HttpOnly igual que los JWT del dueño
    response.set_cookie(
        key='empleado_session',
        value=session_token,
        max_age=60 * 60 * 12,
        httponly=True,
        secure=settings.SIMPLE_JWT.get('AUTH_COOKIE_SECURE', False),
        samesite='Lax',
        path='/',
    )
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def verificar_sesion_empleado(request):
    """
    Verifica la cookie de sesión de empleado.
    Devuelve rol y sede — el frontend lo usa al recargar.
    """
    session_token = request.COOKIES.get('empleado_session')
    if not session_token:
        return Response({'autenticado': False}, status=401)

    session_key = f"empleado_session_{session_token}"
    session_data = cache.get(session_key)

    if not session_data:
        return Response({'autenticado': False}, status=401)

    return Response({
        'autenticado': True,
        'empleado': session_data,  # { empleado_id, nombre, rol, sede_id, negocio_id }
    })