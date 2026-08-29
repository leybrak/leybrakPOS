"""
Django settings for core project — VERSIÓN SEGURA
Corregido según auditoría de seguridad.
"""
import os
import dj_database_url
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
load_dotenv()


# ============================================================
# BASE
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent

# ============================================================
# SEGURIDAD CRÍTICA
# ============================================================
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("La variable de entorno SECRET_KEY no está definida.")

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

_allowed = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(',') if h.strip()]

# ============================================================
# APLICACIONES
# ============================================================
INSTALLED_APPS = [
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "unfold.contrib.inlines",
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'encrypted_model_fields',
    'corsheaders',
    'negocios',
]
FIELD_ENCRYPTION_KEY = os.environ.get('FIELD_ENCRYPTION_KEY', '')

ASGI_APPLICATION = 'core.asgi.application'

# ============================================================
# CHANNEL LAYERS
# ============================================================
REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379')

if os.environ.get('USE_REDIS', 'True') == 'True':
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer"
        }
    }

# ============================================================
# MIDDLEWARE
# ============================================================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    #'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# ============================================================
# BASE DE DATOS
# ============================================================
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL', f'sqlite:///{BASE_DIR}/db.sqlite3'),
        conn_max_age=600
    )
}

# ============================================================
# VALIDACIÓN DE CONTRASEÑAS
# ============================================================
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ============================================================
# INTERNACIONALIZACIÓN
# ============================================================
LANGUAGE_CODE = 'es-pe'
TIME_ZONE = 'America/Lima'
USE_I18N = True
USE_TZ = True

# ============================================================
# ARCHIVOS ESTÁTICOS
# ============================================================
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
#STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================================
# CORS & CSRF  — definido UNA sola vez
# ============================================================
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True  # Necesario para que el navegador envíe cookies cross-origin

_extra_cors = os.environ.get('CORS_EXTRA_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [o.strip() for o in _extra_cors.split(',') if o.strip()]

if DEBUG:
    # Solo en desarrollo local
    CORS_ALLOWED_ORIGINS += [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

# CSRF debe coincidir exactamente con los orígenes permitidos
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-empleado-id',
]

# ============================================================
# HEADERS DE SEGURIDAD HTTP
# ============================================================
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'same-origin'

# ✅ HTTPS controlado por variable de entorno — nunca hardcodeado
# Cuando tengas TLS activo, pon HTTPS_ENABLED=True en tu .env
_https = os.environ.get('HTTPS_ENABLED', 'False') == 'True'

# El TLS termina en Cloudflare/NPM; el contenedor recibe HTTP plano con la
# cabecera X-Forwarded-Proto (la setea nginx.conf). Esto le dice a Django que
# confíe en esa cabecera para detectar HTTPS y NO entrar en bucle de redirección
# cuando SECURE_SSL_REDIRECT=True.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SECURE_SSL_REDIRECT             = _https
# El healthcheck del deploy y los chequeos internos pegan directo a
# http://localhost:8000/api/health/ (sin pasar por el proxy, sin X-Forwarded-Proto).
# Eximimos esa ruta del redirect a HTTPS para que no devuelva 301 y rompa el deploy.
SECURE_REDIRECT_EXEMPT          = [r'^api/health/?$']
SESSION_COOKIE_SECURE           = _https
CSRF_COOKIE_SECURE              = _https
SECURE_HSTS_SECONDS             = 31536000 if _https else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS  = _https
SECURE_HSTS_PRELOAD             = _https

# ============================================================
# REST FRAMEWORK
# ============================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # ✅ Solo CookieJWTAuthentication — lee el token desde la cookie HttpOnly
        # El JWTAuthentication estándar (que lee el header Authorization) ya no es necesario
        'negocios.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/hour',
        'user': '1000/hour',
        'intentos_pin': '5/minute',
        'login': '5/minute',   # ✅ FIX #8: frena fuerza bruta en endpoints de login
        # Webhook de MercadoPago: AllowAny pero con reintentos agresivos de MP,
        # por eso un límite alto en vez de caer en 'anon': 60/hour.
        'mp_webhook': '300/minute',
    },
}

# ============================================================
# SIMPLE JWT
# ============================================================
SIMPLE_JWT = {
    # ✅ FIX #7: Tiempos de vida reducidos
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),  # sesión activa corta
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),       # una semana, no un año

    'AUTH_HEADER_TYPES': ('Bearer',),
    'BLACKLIST_AFTER_ROTATION': True,   # el refresh usado queda en lista negra
    'ROTATE_REFRESH_TOKENS': True,      # cada refresh emite un nuevo par de tokens
    'UPDATE_LAST_LOGIN': True,
    'TOKEN_OBTAIN_SERIALIZER': 'negocios.serializers.CustomTokenObtainPairSerializer',

    # ── Configuración de cookies HttpOnly (FIX #2) ──────────────────────────
    # IMPORTANTE: SimpleJWT no lee estas claves automáticamente.
    # Son usadas por negocios/authentication.py (CookieJWTAuthentication)
    # y por las vistas de login/refresh/logout para set_cookie / delete_cookie.
    'AUTH_COOKIE':          'access_token',
    'AUTH_COOKIE_REFRESH':  'refresh_token',
    'AUTH_COOKIE_HTTP_ONLY': True,       # JS nunca puede leer el token
    'AUTH_COOKIE_SECURE':   _https,      # True automáticamente cuando HTTPS esté activo
    'AUTH_COOKIE_SAMESITE': 'Strict',    # ✅ Strict > Lax para un POS interno
    'AUTH_COOKIE_PATH':     '/',
}


MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
# ============================================================
# EVOLUTION API
# ============================================================
EVO_API_URL = os.environ.get('EVO_API_URL', 'https://api.leybrak.com')
EVO_GLOBAL_KEY = os.environ.get('EVO_GLOBAL_KEY', 'BravaSuperSecret2026')
APIS_NET_PE_TOKEN = os.environ.get('APIS_NET_PE_TOKEN', '')
# Token compartido para los endpoints del cron de n8n (historias programadas).
# Si no se define, los views usan EVO_GLOBAL_KEY como fallback.
BOT_API_TOKEN = os.environ.get('BOT_API_TOKEN', '')

# 🎨 Gemini para mejorar fotos de productos con IA (opcional).
# Si GEMINI_API_KEY está vacío, solo funciona el realce determinístico (Pillow).
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_IMAGE_MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image-preview')

# 🧾 Envío del ticket/boleta por WhatsApp al finalizar el cobro.
# El backend dispara este webhook de n8n y n8n envía vía Evolution API
# (así no hay que salir de la app). Si está vacío, el envío se omite sin error.
N8N_TICKET_WEBHOOK_URL = os.environ.get('N8N_TICKET_WEBHOOK_URL', '')

# 📊 Panel de staff — API de n8n para reportar ejecuciones/errores recientes
# (Settings > API dentro de n8n). Opcional: si falta, el panel muestra
# "n8n no configurado" en vez de fallar.
N8N_API_URL = os.environ.get('N8N_API_URL', '')
N8N_API_KEY = os.environ.get('N8N_API_KEY', '')

# settings.py
# Reemplaza las últimas líneas de email por esto:
EMAIL_BACKEND     = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST        = os.environ.get('EMAIL_HOST', 'smtp.zoho.com')
EMAIL_PORT        = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS     = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER   = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL', 'Leybrak Tech <soporte@leybrak.com>')

from django.templatetags.static import static
from django.urls import reverse_lazy

UNFOLD = {
    "SITE_TITLE": "Leybrak POS",
    "SITE_HEADER": "Leybrak POS",
    "SITE_SYMBOL": "storefront", # Ícono de tienda moderno
    "COLORS": {
        "primary": {
            "50": "250 245 255",
            "100": "243 232 255",
            "200": "233 213 255",
            "300": "216 180 254",
            "400": "192 132 252",
            "500": "168 85 247", # El morado de Leybrak
            "600": "147 51 234",
            "700": "126 34 206",
            "800": "107 33 168",
            "900": "88 28 135",
            "950": "59 7 100",
        },
    },
}


MP_APP_ID         = os.getenv('MP_APP_ID', '')
MP_CLIENT_SECRET  = os.getenv('MP_CLIENT_SECRET', '')
MP_REDIRECT_URI   = os.getenv('MP_REDIRECT_URI', 'http://localhost:8000/api/mp/oauth/callback/')
MP_WEBHOOK_SECRET = os.getenv('MP_WEBHOOK_SECRET', '')
FRONTEND_URL      = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# ── Cobro de suscripción (cuenta única de Leybrak en MercadoPago) ──────────
MP_ACCESS_TOKEN   = os.getenv('MP_ACCESS_TOKEN', '')   # TEST-... (sandbox) / APP_USR-... (prod)
MP_SANDBOX        = os.getenv('MP_SANDBOX', 'True') == 'True'
BACKEND_URL       = os.getenv('BACKEND_URL', 'http://localhost:8000')

# ── Facturación electrónica (Nubefact) — credenciales del entorno DEMO ──────
# (En producción cada negocio usa su propia ruta/token, guardados encriptados.)
NUBEFACT_DEMO_RUTA  = os.getenv('NUBEFACT_DEMO_RUTA',  '')
NUBEFACT_DEMO_TOKEN = os.getenv('NUBEFACT_DEMO_TOKEN', '')