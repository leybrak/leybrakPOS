# negocios/serializers_jwt.py
"""
🛡️ FIX #2: CustomTokenObtainPairView y CustomTokenRefreshView

Los tokens JWT ya NO se devuelven en el cuerpo de la respuesta JSON.
En su lugar, se setean como cookies HttpOnly; Secure; SameSite=Lax.

Esto previene que código JavaScript (incluyendo scripts XSS inyectados)
pueda leer los tokens desde document.cookie o localStorage.

El frontend debe configurar axios con `withCredentials: true` para
que las cookies se envíen automáticamente en cada request.
"""
from django.conf import settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle


def _set_token_cookies(response, access_token, refresh_token=None):
    """
    Setea los tokens JWT como cookies HttpOnly.
    Centraliza la configuración para evitar inconsistencias.
    """
    jwt_settings = settings.SIMPLE_JWT
    secure = jwt_settings.get('AUTH_COOKIE_SECURE', False)
    samesite = jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax')
    http_only = jwt_settings.get('AUTH_COOKIE_HTTP_ONLY', True)
    path = jwt_settings.get('AUTH_COOKIE_PATH', '/')

    # Calcular max_age en segundos desde timedelta
    access_lifetime = jwt_settings.get('ACCESS_TOKEN_LIFETIME')
    refresh_lifetime = jwt_settings.get('REFRESH_TOKEN_LIFETIME')

    response.set_cookie(
        key=jwt_settings.get('AUTH_COOKIE', 'access_token'),
        value=str(access_token),
        max_age=int(access_lifetime.total_seconds()) if access_lifetime else 3600,
        httponly=http_only,
        secure=secure,
        samesite=samesite,
        path=path,
    )

    if refresh_token is not None:
        response.set_cookie(
            key=jwt_settings.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
            value=str(refresh_token),
            max_age=int(refresh_lifetime.total_seconds()) if refresh_lifetime else 86400,
            httponly=http_only,
            secure=secure,
            samesite=samesite,
            path=path,
        )

    return response


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Datos adicionales en el payload del JWT
        if hasattr(user, 'negocio'):
            token['negocio_id'] = user.negocio.id
            token['rol'] = 'Dueño'
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login del administrador/dueño.
    Devuelve datos no-sensibles en el body y setea tokens en cookies HttpOnly.
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        tokens = serializer.validated_data
        access_token  = tokens.get('access')
        refresh_token = tokens.get('refresh')
        user = serializer.user

        # Solo enviamos datos no-sensibles en el body JSON
        # (mismo cálculo de rol que verificar_sesion en publico_views.py)
        if user.is_superuser:
            rol = 'SuperAdmin'
        elif hasattr(user, 'negocio'):
            rol = 'Dueño'
        else:
            rol = 'Admin'

        negocio = getattr(user, 'negocio', None)
        nombre_perfil = (negocio.nombre_propietario if negocio else '') or user.get_full_name() or user.username
        avatar_url = None
        if negocio and negocio.avatar_propietario:
            avatar_url = request.build_absolute_uri(negocio.avatar_propietario.url)

        response_data = {
            'negocio_id': negocio.id if negocio else None,
            'rol': rol,
            'nombre': nombre_perfil,
            'avatar': avatar_url,
            # ⚠️  Los tokens NO van aquí — viajan en las cookies HttpOnly
        }

        response = Response(response_data, status=status.HTTP_200_OK)
        _set_token_cookies(response, access_token, refresh_token)
        return response


class CustomTokenRefreshView(TokenRefreshView):
    """
    Refresco de token.
    Lee el refresh token de la cookie HttpOnly (no del body).
    Devuelve el nuevo access token también como cookie.
    """

    def post(self, request, *args, **kwargs):
        # Leer el refresh token desde la cookie, no del body
        refresh_token = request.COOKIES.get(
            settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
        )

        if not refresh_token:
            return Response(
                {'error': 'No se encontró el refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Inyectamos el token en el request.data para que el serializer lo procese
        request._full_data = {'refresh': refresh_token}

        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            return Response(
                {'error': 'Refresh token inválido o expirado.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        new_access = response.data.get('access')
        new_refresh = response.data.get('refresh')  # Solo si ROTATE_REFRESH_TOKENS=True

        # Limpiar tokens del body de la respuesta
        response.data = {'detail': 'Token renovado correctamente.'}

        # Setear nuevas cookies
        _set_token_cookies(response, new_access, new_refresh)
        return response


class LogoutView:
    """
    Logout: elimina las cookies de tokens.
    Registrar en urls.py como:
        path('token/logout/', LogoutView.as_view())
    """
    from rest_framework.views import APIView
    from rest_framework.permissions import IsAuthenticated

    class _View(APIView):
        permission_classes = []  # Permite logout incluso con token expirado

        def post(self, request, *args, **kwargs):
            response = Response({'detail': 'Sesión cerrada correctamente.'}, status=status.HTTP_200_OK)
            jwt_settings = settings.SIMPLE_JWT

            # Eliminar ambas cookies seteando max_age=0
            response.delete_cookie(
                key=jwt_settings.get('AUTH_COOKIE', 'access_token'),
                path=jwt_settings.get('AUTH_COOKIE_PATH', '/'),
                samesite=jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'),
            )
            response.delete_cookie(
                key=jwt_settings.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
                path=jwt_settings.get('AUTH_COOKIE_PATH', '/'),
                samesite=jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'),
            )
            return response

    # Exponer como clase con .as_view()
    as_view = _View.as_view


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

@api_view(['POST'])
@permission_classes([AllowAny])
def login_movil(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'Usuario y contraseña requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username, password=password)
    if not user:
        return Response(
            {'error': 'Credenciales inválidas.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.is_active:
        return Response(
            {'error': 'Cuenta desactivada.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    refresh = RefreshToken.for_user(user)
    negocio = getattr(user, 'negocio', None)

    # ✅ Buscar o crear empleado "Dueño" para este negocio
    empleado_id = None
    if negocio:
        from .models import Empleado, Rol, Sede
        try:
            rol_dueno = Rol.objects.get(nombre='Dueño')
            sede_principal = Sede.objects.filter(negocio=negocio).first()
            empleado_dueno, creado = Empleado.objects.get_or_create(
                negocio=negocio,
                rol=rol_dueno,
                defaults={
                    'nombre': user.get_full_name() or user.username,
                    'pin': '0000',
                    'activo': True,
                    'sede': sede_principal,
                }
            )
            empleado_id = empleado_dueno.id
        except Exception as e:
            pass  # Si falla, empleado_id queda None

    return Response({
        'access':      str(refresh.access_token),
        'refresh':     str(refresh),
        'negocio_id':  negocio.id if negocio else None,
        'rol':         'dueño',
        'nombre':      user.get_full_name() or user.username,
        'empleado_id': empleado_id,  # ✅ Nuevo campo
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])  
def refresh_movil(request):
    """
    Refresco de token para la app móvil.
    Lee el refresh del body (no de cookies).
    """
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response(
            {'error': 'Refresh token requerido.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        refresh = RefreshToken(refresh_token)
        return Response({
            'access': str(refresh.access_token),
        }, status=status.HTTP_200_OK)
    except Exception:
        return Response(
            {'error': 'Token inválido o expirado.'},
            status=status.HTTP_401_UNAUTHORIZED
        )